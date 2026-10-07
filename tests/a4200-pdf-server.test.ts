import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { resolveOpisBasename } from "../services/a4200-pdf/src/lib/opis-resolve.mjs";
import { ClientError } from "../services/a4200-pdf/src/lib/client-error.mjs";
import { parseZipP7bEntries, MAX_ZIP_ENTRIES } from "../services/a4200-pdf/src/lib/zip-ingest.mjs";
import { formatDuk422Payload } from "../services/a4200-pdf/src/lib/duk-format.mjs";
import { buildPdfDownloadName } from "../services/a4200-pdf/src/lib/pdf-filename.mjs";
import { clientIp, trustProxyEnabled } from "../services/a4200-pdf/src/lib/client-ip.mjs";
import {
  checkRate,
  resetRateLimitForTests,
  rateLimitConfig,
} from "../services/a4200-pdf/src/lib/rate-limit.mjs";
import { handleRouteError } from "../services/a4200-pdf/src/server.mjs";
import { JavaTimeoutError } from "../services/a4200-pdf/src/lib/client-error.mjs";
import { toHttps } from "../services/a4200-pdf/scripts/download-duk.mjs";
import { safeEnd } from "../services/a4200-pdf/src/lib/respond.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, "fixtures/a4200/datecs-anon");

function mockRes() {
  let status = 0;
  let body = "";
  let ended = false;
  let headersSent = false;
  const res = {
    headersSent: false,
    writableEnded: false,
    writeHead(code: number) {
      status = code;
      headersSent = true;
      res.headersSent = true;
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) body += String(chunk);
      ended = true;
      res.writableEnded = true;
    },
    get status() {
      return status;
    },
    get body() {
      return body;
    },
    get ended() {
      return ended;
    },
  };
  return res;
}

test("resolveOpisBasename: missing opis when only day files", () => {
  assert.throws(
    () => resolveOpisBasename(["9999999901_Z0011.p7b", "9999999901_Z0012.p7b"]),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).status, 400);
      assert.match((e as ClientError).message, /Lipsește opisul/i);
      assert.equal((e as ClientError).code, "NO_OPIS");
      return true;
    },
  );
});

test("resolveOpisBasename: multiple Perioada_raportare.p7b", () => {
  assert.throws(
    () => resolveOpisBasename(["Perioada_raportare.p7b", "Perioada_raportare.p7b", "a_Z0001.p7b"]),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).code, "MULTIPLE_OPIS");
      return true;
    },
  );
});

test("parseZipP7bEntries: corrupt zip is 400 not 500", () => {
  assert.throws(
    () => parseZipP7bEntries(Buffer.from("not a zip")),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).status, 400);
      assert.match((e as ClientError).message, /coruptă/i);
      return true;
    },
  );
});

test("parseZipP7bEntries: duplicate basename rejected", () => {
  const inner = new Uint8Array([1, 2, 3]);
  const zip = zipSync({
    "a/Perioada_raportare.p7b": inner,
    "b/Perioada_raportare.p7b": inner,
  });
  assert.throws(
    () => parseZipP7bEntries(Buffer.from(zip)),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).code, "ZIP_DUPLICATE");
      return true;
    },
  );
});

test("parseZipP7bEntries: too many entries", () => {
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < MAX_ZIP_ENTRIES + 1; i++) {
    entries[`f${i}.txt`] = new Uint8Array([0]);
  }
  const zip = zipSync(entries);
  assert.throws(
    () => parseZipP7bEntries(Buffer.from(zip)),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).status, 413);
      return true;
    },
  );
});

test("parseZipP7bEntries: unzipped size cap", () => {
  const big = new Uint8Array(200);
  const zip = zipSync({ "big.p7b": big });
  assert.throws(
    () => parseZipP7bEntries(Buffer.from(zip), { maxUnzipped: 50 }),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).code, "ZIP_BOMB");
      return true;
    },
  );
});

test("formatDuk422Payload maps R1.1 and extragere XML with details", () => {
  const raw = "E: validari globale\n eroare regula: R1.1 numar zile diferit\nEroare extragere XML din fisier";
  const p = formatDuk422Payload(raw);
  assert.equal(p.details, raw);
  assert.ok(p.message.length > 0);
  assert.ok(p.nextStep.length > 0);
  assert.ok(p.lines.some((l) => /R1\.1|zile/i.test(l.raw)));
});

test("buildPdfDownloadName from anonymized opis", () => {
  const opis = fs.readFileSync(path.join(FIX_DIR, "Perioada_raportare.p7b"));
  const name = buildPdfDownloadName(opis);
  assert.equal(name, "A4200_9999999901_Z11-Z13.pdf");
});

test("clientIp: ignores X-Forwarded-For unless TRUST_PROXY", () => {
  const prev = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  const req = {
    headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" },
  };
  assert.equal(clientIp(req), "127.0.0.1");
  process.env.TRUST_PROXY = "1";
  assert.ok(trustProxyEnabled());
  assert.equal(clientIp(req), "10.0.0.1");
  process.env.TRUST_PROXY = prev;
});

test("rate limiter evicts expired buckets", () => {
  resetRateLimitForTests();
  const { max } = rateLimitConfig();
  const ip = "test-client";
  for (let i = 0; i < max; i++) {
    assert.equal(checkRate(ip, 1_000), true);
  }
  assert.equal(checkRate(ip, 1_000), false);
  const window = rateLimitConfig().windowMs;
  assert.equal(checkRate(ip, 1_000 + window + 1), true);
  resetRateLimitForTests();
});

test("handleRouteError: Java timeout → 504", () => {
  const res = mockRes();
  handleRouteError(res, "https://tapselo.com", new JavaTimeoutError());
  assert.equal(res.status, 504);
  assert.match(res.body, /Timpul alocat/);
});

test("safeEnd does not send twice", () => {
  const res = mockRes();
  assert.equal(safeEnd(res, 200, {}, "a"), true);
  assert.equal(safeEnd(res, 500, {}, "b"), false);
  assert.equal(res.body, "a");
});

test("download-duk toHttps rewrites http URLs", () => {
  assert.equal(
    toHttps("http://static.anaf.ro/static/10/Anaf/update5/zz9/DUKIntegrator.jar"),
    "https://static.anaf.ro/static/10/Anaf/update5/zz9/DUKIntegrator.jar",
  );
});
