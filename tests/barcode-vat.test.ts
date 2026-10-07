// Run: npm test (node --test, native TypeScript type stripping, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleBarcodeRequest,
  RateLimiter,
  toBarcodeVat,
  MSG_INVALID,
  MSG_IN_STORE,
  MSG_NOT_FOUND,
  MSG_RATE_LIMIT,
} from "../src/lib/barcode-vat.ts";
import { MSG_MISSING, type RpcResult } from "../src/lib/supabase-public.ts";

const EAN = "5941234567899";
const ok = (data: unknown): RpcResult<unknown> => ({ ok: true, data });

function call(ean: string | undefined, data: RpcResult<unknown>, opts: { ip?: string; method?: string; limiter?: RateLimiter; now?: number } = {}) {
  const calls: string[] = [];
  const headers: Record<string, string> = opts.ip ? { "CF-Connecting-IP": opts.ip } : {};
  const res = handleBarcodeRequest(
    new Request(`https://tapselo.com/api/barcodes/${ean}`, { method: opts.method ?? "GET", headers }),
    ean,
    {
      lookup: async (e) => {
        calls.push(e);
        return data;
      },
      limiter: opts.limiter ?? new RateLimiter(),
      now: opts.now,
    },
  );
  return { res, calls };
}

test("200: whitelisted fields only, cache and safety headers", async () => {
  const { res, calls } = call(EAN, ok({ ean: EAN, name: " LAPTE ZUZU 1L ", category: "LACTATE", vat_rate: 11, price_cents: 999, store_id: "x" }));
  const r = await res;
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ean: EAN, name: "LAPTE ZUZU 1L", category: "LACTATE", vat_rate: 11 });
  assert.deepEqual(calls, [EAN]);
  assert.equal(r.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=3600");
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

test("names with markup come out escaped, never as raw <", async () => {
  const name = `<IMG SRC=X ONERROR=ALERT(1)>`;
  const r = await call(EAN, ok({ ean: EAN, name, vat_rate: 21 })).res;
  const text = await r.text();
  assert.ok(!text.includes("<"));
  assert.equal(JSON.parse(text).name, name);
});

test("400 for invalid codes, without calling the database", async () => {
  for (const bad of [undefined, "", "abc", "594123456789", "5941234567890", "59412345678990", "12345670"]) {
    const { res, calls } = call(bad, ok(null));
    const r = await res;
    assert.equal(r.status, 400, String(bad));
    assert.deepEqual(await r.json(), { error: MSG_INVALID });
    assert.equal(calls.length, 0);
  }
});

test("400 for in-store prefixes 20-29, without calling the database", async () => {
  const { res, calls } = call("2800100012341", ok(null));
  const r = await res;
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: MSG_IN_STORE });
  assert.equal(calls.length, 0);
});

test("404 in Romanian when the catalog has nothing, short cache", async () => {
  const r = await call(EAN, ok(null)).res;
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: MSG_NOT_FOUND });
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=300");
});

test("503, not cached, when the RPC fails or answers off-contract", async () => {
  for (const data of [
    { ok: false, kind: "network", message: "x" } as RpcResult<unknown>,
    ok({ ean: EAN, name: "X", vat_rate: 0 }),
    ok({ ean: "5900000000008", name: "X", vat_rate: 21 }),
    ok([{ ean: EAN, name: "X", vat_rate: 21 }]),
  ]) {
    const r = await call(EAN, data).res;
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { error: MSG_MISSING });
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  }
});

test("429 with Retry-After per CF-Connecting-IP; other IPs unaffected", async () => {
  const limiter = new RateLimiter();
  const now = Date.UTC(2026, 9, 7, 12, 0, 10);
  for (let i = 0; i < 30; i++) {
    assert.equal((await call(EAN, ok(null), { ip: "203.0.113.1", limiter, now }).res).status, 404);
  }
  const { res, calls } = call(EAN, ok(null), { ip: "203.0.113.1", limiter, now });
  const r = await res;
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: MSG_RATE_LIMIT });
  assert.equal(r.headers.get("Retry-After"), "50");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal(calls.length, 0);
  assert.equal((await call(EAN, ok(null), { ip: "203.0.113.2", limiter, now }).res).status, 404);
  assert.equal((await call(EAN, ok(null), { ip: "203.0.113.1", limiter, now: now + 60_000 }).res).status, 404);
});

test("daily cap of 500 per IP", () => {
  const limiter = new RateLimiter();
  const start = Date.UTC(2026, 9, 7, 0, 0, 0);
  for (let i = 0; i < 500; i++) assert.equal(limiter.hit("198.51.100.7", start + i * 3_000), 0);
  const wait = limiter.hit("198.51.100.7", start + 500 * 3_000);
  assert.equal(wait, 86_400 - 1_500);
  assert.equal(limiter.hit("198.51.100.7", start + 86_400_000), 0);
});

test("HEAD has headers and no body; other methods 405", async () => {
  const head = await call(EAN, ok({ ean: EAN, name: "X", vat_rate: 21 }), { method: "HEAD" }).res;
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const post = await call(EAN, ok(null), { method: "POST" }).res;
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
});

test("toBarcodeVat drops empty category and rejects missing name", () => {
  assert.deepEqual(toBarcodeVat(EAN, { ean: EAN, name: "A", category: " ", vat_rate: 21 }), { ean: EAN, name: "A", vat_rate: 21 });
  assert.equal(toBarcodeVat(EAN, { ean: EAN, name: "  ", vat_rate: 21 }), null);
  assert.equal(toBarcodeVat(EAN, null), null);
});
