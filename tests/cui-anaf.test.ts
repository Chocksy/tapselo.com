import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretAnafResponseText,
  looksLikeHtmlResponse,
} from "../src/lib/cui-anaf/anaf-response.ts";
import { isValidCui, normalizeCui } from "../src/lib/cui-anaf/normalize.ts";
import { parseAnafResponse } from "../src/lib/cui-anaf/parse.ts";
import { efacturaRegistryValue } from "../src/lib/cui-anaf/labels.ts";
import { AnafRequestThrottle } from "../src/lib/cui-anaf/throttle.ts";
import {
  assertCuiBatchWithinLimit,
  fetchAnafCompany,
  handleAnafCuiGet,
  MSG_ANAF_UNAVAILABLE,
  MSG_NOT_FOUND,
} from "../src/lib/cui-anaf/proxy.ts";
import { ANAF_MAX_CUIS_PER_REQUEST, ANAF_TVA_URL } from "../src/lib/cui-anaf/constants.ts";

const FIXTURE = readFileSync(join(process.cwd(), "tests/fixtures/anaf-v9-sample.json"), "utf8");

test("CUI normalize and checksum", () => {
  assert.equal(normalizeCui("RO 14399840"), "14399840");
  assert.equal(normalizeCui("ro14399840"), "14399840");
  assert.equal(normalizeCui("abc"), null);
  assert.ok(isValidCui("14399840"));
  assert.ok(!isValidCui("14399841"));
});

test("fixture maps Dante International (statusRO_e_Factura in date_generale)", () => {
  const outcome = interpretAnafResponseText(FIXTURE, "14399840");
  assert.equal(outcome.kind, "ok");
  if (outcome.kind !== "ok") return;
  assert.equal(outcome.company.name, "DANTE INTERNATIONAL SA");
  assert.equal(outcome.company.vat_payer, true);
  assert.equal(outcome.company.efactura_registry, false);
  assert.equal(efacturaRegistryValue(false, null), "nu apare în Registrul RO e-Factura");
});

test("HTML ANAF error page is unavailable, not not-found", () => {
  assert.ok(looksLikeHtmlResponse("<html><body>404</body></html>"));
  const outcome = interpretAnafResponseText("<html>not found</html>", "14399840");
  assert.equal(outcome.kind, "unavailable");
  assert.throws(() => parseAnafResponse("<html>x</html>", "1"));
});

test("notFound CUI in fixture (interpret layer)", () => {
  const outcome = interpretAnafResponseText(FIXTURE, "1");
  assert.equal(outcome.kind, "not_found");
});

function validCuiNotInFixture(): string {
  for (let n = 10_000_000; n < 10_001_000; n++) {
    const s = String(n);
    if (isValidCui(s) && s !== "14399840") return s;
  }
  throw new Error("no sample CUI");
}

test("AnafRequestThrottle enforces ~1 second gap", async () => {
  const t = new AnafRequestThrottle(100);
  const start = Date.now();
  await t.acquire(start);
  await t.acquire();
  assert.ok(Date.now() - start >= 90);
});

test("assertCuiBatchWithinLimit", () => {
  assert.throws(() => assertCuiBatchWithinLimit(101), /100/);
  assert.throws(() => assertCuiBatchWithinLimit(0));
});

test("proxy fetchAnafCompany uses ANAF POST body and caches", async () => {
  let calls = 0;
  const memory = new Map<string, Response>();
  const cache = {
    async match(key: string) {
      return memory.get(key) ?? undefined;
    },
    async put(key: string, res: Response) {
      memory.set(key, res.clone());
    },
  } as Cache;

  const throttle = new AnafRequestThrottle(0);
  const fetchFn: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, ANAF_TVA_URL);
    const body = JSON.parse(String(init?.body)) as { cui: number; data: string }[];
    assert.equal(body.length, 1);
    assert.equal(body[0].cui, 14399840);
    return new Response(FIXTURE, { status: 200 });
  };

  const first = await fetchAnafCompany("14399840", {
    fetch: fetchFn,
    throttle,
    today: "2026-10-09",
    cache,
    cacheKey: (c, d) => `k:${c}:${d}`,
  });
  assert.equal(first.ok, true);
  assert.equal(calls, 1);

  const second = await fetchAnafCompany("14399840", {
    fetch: fetchFn,
    throttle,
    today: "2026-10-09",
    cache,
    cacheKey: (c, d) => `k:${c}:${d}`,
  });
  assert.equal(second.ok, true);
  assert.equal(calls, 1);
});

test("proxy returns anaf_unavailable on HTML 404 from wrong ANAF path", async () => {
  const result = await fetchAnafCompany("14399840", {
    fetch: async () => new Response("<html>404</html>", { status: 404 }),
    throttle: new AnafRequestThrottle(0),
    today: "2026-10-09",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "anaf_unavailable");
  assert.equal(result.error, MSG_ANAF_UNAVAILABLE);
});

test("handleAnafCuiGet rejects invalid CUI without calling ANAF", async () => {
  let called = false;
  const res = await handleAnafCuiGet(new Request("https://tapselo.com/api/anaf/cui/bad"), "bad", {
    fetch: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
    throttle: new AnafRequestThrottle(0),
  });
  assert.equal(res.status, 400);
  assert.ok(!called);
});

test("handleAnafCuiGet not_found includes code", async () => {
  const missing = validCuiNotInFixture();
  const payload = JSON.stringify({ found: [], notFound: [Number(missing)] });
  const res = await handleAnafCuiGet(new Request(`https://tapselo.com/api/anaf/cui/${missing}`), missing, {
    fetch: async () => new Response(payload, { status: 200 }),
    throttle: new AnafRequestThrottle(0),
    today: "2026-10-09",
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.code, "not_found");
  assert.equal(body.error, MSG_NOT_FOUND);
});

test("handleAnafCuiGet returns 429 when throttled", async () => {
  const throttle = new AnafRequestThrottle(60_000);
  await throttle.acquire(Date.now());
  const res = await handleAnafCuiGet(new Request("https://tapselo.com/api/anaf/cui/14399840"), "14399840", {
    fetch: async () => new Response(FIXTURE, { status: 200 }),
    throttle,
    today: "2026-10-09",
  });
  assert.equal(res.status, 429);
});

test("live ANAF smoke (when reachable)", async () => {
  const res = await handleAnafCuiGet(new Request("http://localhost/api/anaf/cui/14399840"), "14399840", {
    fetch: globalThis.fetch.bind(globalThis),
    throttle: new AnafRequestThrottle(0),
    today: "2026-10-09",
  });
  if (res.status === 503) {
    console.log("skip live ANAF smoke: unreachable from this environment");
    return;
  }
  assert.equal(res.status, 200);
  const company = await res.json();
  assert.match(company.name, /DANTE/i);
});
