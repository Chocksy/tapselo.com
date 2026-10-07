import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { resolveOpisBasename } from "../services/a4200-pdf/src/lib/opis-resolve.mjs";
import { ClientError } from "../services/a4200-pdf/src/lib/client-error.mjs";
import { parseZipP7bEntries, MAX_ZIP_ENTRIES } from "../services/a4200-pdf/src/lib/zip-ingest.mjs";
import { buildPdfDownloadName } from "../services/a4200-pdf/src/lib/pdf-filename.mjs";
import { clientIp, trustProxyEnabled } from "../services/a4200-pdf/src/lib/client-ip.mjs";
import {
  checkRate,
  resetRateLimitForTests,
  rateLimitConfig,
} from "../services/a4200-pdf/src/lib/rate-limit.mjs";
import { handleRouteError, server } from "../services/a4200-pdf/src/server.mjs";
import http from "node:http";
import { JavaTimeoutError } from "../services/a4200-pdf/src/lib/client-error.mjs";
import { toHttps } from "../services/a4200-pdf/scripts/download-duk.mjs";
import { safeEnd } from "../services/a4200-pdf/src/lib/respond.mjs";
import { parseMultipartBody, MULTIPART_MAX_FILES } from "../services/a4200-pdf/src/lib/multipart.mjs";
import { isDukValidationSectionHeader, formatDuk422Payload } from "../services/a4200-pdf/src/lib/duk-format.mjs";
import { REQUEST_TIMEOUT_RESPONSE } from "../services/a4200-pdf/src/lib/api-errors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, "fixtures/a4200/datecs-anon");

function buildMultipartP7b(filenames: string[]) {
  const boundary = "----TapseloTestBoundary";
  const chunks: Buffer[] = [];
  for (const name of filenames) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
    );
    chunks.push(Buffer.from([0x30, 0x01]));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

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

test("formatDuk422Payload prefers DUK_NUI_CHECK over broad NUI_MISMATCH", () => {
  const raw =
    "eroare regula: R1: NUI (9999999901) este nenumeric sau are cifra de control eronata\nCUI invalid in opis";
  const p = formatDuk422Payload(raw);
  assert.equal(p.message, "NUI invalid (cifră de control)");
  assert.match(p.nextStep, /Reexportă|certificat/i);
});

test("formatDuk422Payload maps CUI invalid to dedicated entry", () => {
  const p = formatDuk422Payload("Eroare: CUI invalid la validare");
  assert.equal(p.message, "CUI invalid pentru ANAF");
});

test("HEAD /health returns 200 with empty body", async () => {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      const req = http.request(
        { host: "127.0.0.1", port, method: "HEAD", path: "/health" },
        (res) => {
          assert.equal(res.statusCode, 200);
          let body = "";
          res.on("data", (c) => {
            body += c;
          });
          res.on("end", () => {
            assert.equal(body, "");
            server.close((err) => (err ? reject(err) : resolve()));
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  });
});

test("formatDuk422Payload maps R1.1 and extragere XML with details", () => {
  const raw = "E: validari globale\n eroare regula: R1.1 numar zile diferit\nEroare extragere XML din fisier";
  const p = formatDuk422Payload(raw);
  assert.equal(p.details, raw);
  assert.ok(p.message.length > 0);
  assert.ok(p.nextStep.length > 0);
  assert.ok(p.lines.some((l) => /R1\.1|zile/i.test(l.raw)));
  assert.ok(isDukValidationSectionHeader("E: validari globale"));
  const section = p.lines.find((l) => l.kind === "section");
  assert.ok(section);
  assert.match(section!.title!, /Antet validare/);
});

test("parseMultipartBody: 32 zile plus opis (33 parts) keeps all files", async () => {
  const names = ["Perioada_raportare.p7b"];
  for (let z = 1; z <= 32; z++) {
    names.push(`9999999901_Z${String(z).padStart(4, "0")}.p7b`);
  }
  assert.equal(names.length, 33);
  const { body, contentType } = buildMultipartP7b(names);
  const parsed = await parseMultipartBody(body, contentType, 25 * 1024 * 1024);
  assert.equal(parsed.files.length, 33);
  resolveOpisBasename(parsed.files.map((f) => f.name));
});

test("parseMultipartBody: more than 64 files → 413 JSON ClientError", async () => {
  const names: string[] = ["Perioada_raportare.p7b"];
  for (let i = 0; i < MULTIPART_MAX_FILES; i++) {
    names.push(`9999999901_Z${String(i + 1).padStart(4, "0")}.p7b`);
  }
  assert.equal(names.length, MULTIPART_MAX_FILES + 1);
  const { body, contentType } = buildMultipartP7b(names);
  await assert.rejects(
    () => parseMultipartBody(body, contentType, 25 * 1024 * 1024),
    (e: unknown) => {
      assert.ok(e instanceof ClientError);
      assert.equal((e as ClientError).status, 413);
      assert.ok(["MULTIPART_FILES_LIMIT", "MULTIPART_PARTS_LIMIT"].includes((e as ClientError).code));
      return true;
    },
  );
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

test("clientIp: TRUST_PROXY prefers CF-Connecting-IP (Coolify + Cloudflare)", () => {
  const prev = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  const req = {
    headers: {
      "cf-connecting-ip": "198.51.100.44",
      "x-forwarded-for": "198.51.100.44, 172.16.0.1",
    },
    socket: { remoteAddress: "10.0.0.99" },
  };
  assert.equal(clientIp(req), "198.51.100.44");
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

test("handleRouteError: Java timeout → 504 JSON", () => {
  const res = mockRes();
  handleRouteError(res, "https://tapselo.com", new JavaTimeoutError());
  assert.equal(res.status, 504);
  const j = JSON.parse(res.body);
  assert.equal(j.code, REQUEST_TIMEOUT_RESPONSE.code);
  assert.match(j.message, /Timpul alocat/);
  assert.ok(j.nextStep);
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
