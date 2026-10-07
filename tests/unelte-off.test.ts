import assert from "node:assert/strict";
import { test } from "node:test";
import { RateLimiter } from "../src/lib/barcode-vat.ts";
import {
  handleOffRequest,
  lookupOff,
  MSG_OFF_NOT_FOUND,
  OFF_ATTRIBUTION,
  OFF_FIELDS,
  OFF_USER_AGENT,
  offApiUrl,
  offProductHtml,
  parseOffPayload,
  toOffProduct,
  type OffProduct,
} from "../src/lib/unelte/off.ts";

const EAN = "5941234000013";
const IMG = "https://images.openfoodfacts.org/images/products/594/123/400/0013/front_ro.4.200.jpg";
const EVIL = `<img src=x onerror="window.__xss=1">`;

const offBody = (product: Record<string, unknown>) => ({ code: EAN, status: 1, status_verbose: "product found", product });

test("offApiUrl: v2 product endpoint with the whitelisted fields only", () => {
  assert.equal(
    offApiUrl(EAN),
    `https://world.openfoodfacts.org/api/v2/product/${EAN}.json?fields=product_name,brands,image_front_small_url,image_url,quantity,categories,nutriscore_grade,countries`,
  );
  assert.equal(OFF_FIELDS.length, 8);
});

test("toOffProduct: maps and cleans the OFF fields", () => {
  const p = toOffProduct(
    EAN,
    offBody({
      product_name: "  Telemea  de vacă\n",
      brands: "Napolact, Lactalis, Alt brand",
      quantity: "400 g",
      categories: "Lactate, Brânzeturi, en:white-cheeses",
      nutriscore_grade: "D",
      countries: "România, en:moldova",
      image_front_small_url: IMG,
      image_url: "https://images.openfoodfacts.org/images/products/594/123/400/0013/front_ro.4.full.jpg",
      price: 24.8,
    }),
  );
  assert.deepEqual(p, {
    ean: EAN,
    name: "Telemea de vacă",
    brand: "Napolact, Lactalis",
    quantity: "400 g",
    category: "white cheeses",
    nutriscore: "d",
    countries: "România, moldova",
    image: IMG,
    url: `https://world.openfoodfacts.org/product/${EAN}`,
  });
  assert.equal(toOffProduct(EAN, offBody({ brands: "Coca-Cola" }))?.brand, "Coca-Cola", "dashes in brand names stay");
});

test("toOffProduct: image falls back to image_url, foreign hosts and schemes are dropped", () => {
  assert.equal(toOffProduct(EAN, offBody({ product_name: "X", image_url: IMG }))?.image, IMG);
  for (const bad of [
    "http://images.openfoodfacts.org/images/products/1.jpg",
    "https://evil.example/images/products/1.jpg",
    "https://images.openfoodfacts.org.evil.example/images/products/1.jpg",
    "javascript:alert(1)",
    `https://images.openfoodfacts.org/images/products/1.jpg"onerror="x`,
  ]) {
    assert.equal(toOffProduct(EAN, offBody({ product_name: "X", image_front_small_url: bad }))?.image, null, bad);
  }
});

test("toOffProduct: not found, empty products and junk", () => {
  assert.equal(toOffProduct(EAN, { code: EAN, status: 0, status_verbose: "product not found" }), null);
  assert.equal(toOffProduct(EAN, offBody({ nutriscore_grade: "a", countries: "France" })), null, "nothing worth showing");
  assert.equal(toOffProduct(EAN, offBody({ product_name: "X", nutriscore_grade: "unknown" }))?.nutriscore, null);
  for (const junk of [null, "x", [], { status: 1 }, { status: "1", product: { product_name: "X" } }]) {
    assert.equal(toOffProduct(EAN, junk), null, JSON.stringify(junk));
  }
  const long = toOffProduct(EAN, offBody({ product_name: "a".repeat(500) }));
  assert.equal(long?.name?.length, 160);
});

test("parseOffPayload: re-validates the proxy answer in the browser", () => {
  const good = toOffProduct(EAN, offBody({ product_name: "Telemea", image_front_small_url: IMG }));
  assert.deepEqual(parseOffPayload(EAN, JSON.parse(JSON.stringify(good))), good);
  assert.equal(parseOffPayload("5901234123457", good), null, "ean must match");
  const tampered = parseOffPayload(EAN, { ...good, image: "https://evil.example/x.jpg", url: "https://evil.example/" });
  assert.equal(tampered?.image, null);
  assert.equal(tampered?.url, `https://world.openfoodfacts.org/product/${EAN}`);
});

test("offProductHtml: escapes every field and carries the ODbL / CC BY-SA attribution", () => {
  const p: OffProduct = {
    ean: EAN,
    name: EVIL,
    brand: `"><script>alert(1)</script>`,
    quantity: "1 L",
    category: "<b>x</b>",
    nutriscore: "b",
    countries: "România",
    image: IMG,
    url: `https://world.openfoodfacts.org/product/${EAN}`,
  };
  const html = offProductHtml(p);
  assert.doesNotMatch(html, /<img src=x|<script|<b>/);
  assert.match(html, /&lt;img src=x onerror=&quot;window\.__xss=1&quot;&gt;/);
  assert.match(html, /alt="Imagine produs: &lt;img/);
  assert.match(html, new RegExp(`<img src="${IMG.replace(/[.\/]/g, "\\$&")}"`));
  assert.match(html, /<dt>Nutri-Score<\/dt><dd>B<\/dd>/);
  assert.match(html, /href="https:\/\/world\.openfoodfacts\.org\/product\/5941234000013"/);
  const text = html.replace(/<[^>]+>/g, "");
  assert.ok(text.includes(OFF_ATTRIBUTION), "attribution text");
  assert.equal(OFF_ATTRIBUTION, "Date și imagini: Open Food Facts (ODbL / CC BY-SA)");
  assert.doesNotMatch(html, /pre[țt]|lei/i);
});

test("offProductHtml: only the fields that exist", () => {
  const html = offProductHtml({ ean: EAN, name: null, brand: "Napolact", quantity: null, category: null, nutriscore: null, countries: null, image: null, url: `https://world.openfoodfacts.org/product/${EAN}` });
  assert.doesNotMatch(html, /<img|Denumire|Cantitate/);
  assert.match(html, /<dt>Marcă<\/dt><dd>Napolact<\/dd>/);
});

class MemCache {
  store = new Map<string, Response>();
  async match(req: Request) {
    return this.store.get(req.url)?.clone();
  }
  async put(req: Request, res: Response) {
    this.store.set(req.url, res);
  }
}

function upstream(status: number, body?: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

const req = (ean: string, init: RequestInit = {}) => new Request(`https://tapselo.com/api/off/${ean}?x=1`, init);

test("handleOffRequest: calls OFF with a descriptive User-Agent, caches 200 for a day", async () => {
  const { calls, fetchFn } = upstream(200, offBody({ product_name: "Telemea", brands: "Napolact", image_front_small_url: IMG }));
  const cache = new MemCache();
  const deps = { fetchFn, cache: cache as unknown as Cache, limiter: new RateLimiter() };
  const r = await handleOffRequest(req(EAN), EAN, deps);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=86400");
  const body = await r.json();
  assert.equal(body.name, "Telemea");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, offApiUrl(EAN));
  assert.equal(new Headers(calls[0].init?.headers).get("User-Agent"), OFF_USER_AGENT);
  assert.match(OFF_USER_AGENT, /^Tapselo\/\S+ \(https:\/\/tapselo\.com.*contact@tapselo\.com\)$/);

  const again = await handleOffRequest(req(EAN), EAN, deps);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).name, "Telemea");
  assert.equal(calls.length, 1, "second answer comes from the cache");
  assert.deepEqual([...cache.store.keys()], [`https://tapselo.com/api/off/${EAN}`], "cache key has no query string");
});

test("handleOffRequest: not found (404 or status 0) is cached too", async () => {
  for (const [status, body] of [
    [404, { code: EAN, status: 0, status_verbose: "product not found" }],
    [200, { code: EAN, status: 0 }],
  ] as const) {
    const { fetchFn } = upstream(status, body);
    const cache = new MemCache();
    const r = await handleOffRequest(req(EAN), EAN, { fetchFn, cache: cache as unknown as Cache, limiter: new RateLimiter() });
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: MSG_OFF_NOT_FOUND });
    assert.equal(cache.store.size, 1);
  }
});

test("handleOffRequest: upstream errors are 503 and never cached", async () => {
  for (const status of [429, 500, 502]) {
    const { fetchFn } = upstream(status, {});
    const cache = new MemCache();
    const r = await handleOffRequest(req(EAN), EAN, { fetchFn, cache: cache as unknown as Cache, limiter: new RateLimiter() });
    assert.equal(r.status, 503, String(status));
    assert.equal(r.headers.get("Cache-Control"), "no-store");
    assert.equal(cache.store.size, 0);
  }
  const net = await handleOffRequest(req(EAN), EAN, {
    fetchFn: (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch,
    limiter: new RateLimiter(),
  });
  assert.equal(net.status, 503);
});

test("handleOffRequest: validation, method and rate limit before calling OFF", async () => {
  const { calls, fetchFn } = upstream(200, offBody({ product_name: "X" }));
  const limiter = new RateLimiter();
  for (const bad of ["5941234000014", "123", "2000000000008"]) {
    const r = await handleOffRequest(req(bad), bad, { fetchFn, limiter });
    assert.equal(r.status, 400, bad);
  }
  assert.equal((await handleOffRequest(req(EAN, { method: "POST" }), EAN, { fetchFn, limiter })).status, 405);
  const head = await handleOffRequest(req(EAN, { method: "HEAD" }), EAN, { fetchFn, limiter });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(calls.length, 1);

  const tight = new RateLimiter();
  const now = Date.UTC(2026, 9, 7, 12, 0, 0);
  let last: Response | undefined;
  for (let i = 0; i < 31; i++) {
    last = await handleOffRequest(req(EAN, { headers: { "CF-Connecting-IP": "1.2.3.4" } }), EAN, { fetchFn, limiter: tight, now });
  }
  assert.equal(last?.status, 429);
  assert.ok(Number(last?.headers.get("Retry-After")) > 0);
});

test("lookupOff: same-origin GET, maps 404 and errors", async () => {
  let seen = "";
  let init: RequestInit | undefined;
  const good = toOffProduct(EAN, offBody({ product_name: "Telemea" }));
  const r = await lookupOff(EAN, (async (url: string, i?: RequestInit) => {
    seen = String(url);
    init = i;
    return new Response(JSON.stringify(good), { status: 200 });
  }) as unknown as typeof fetch);
  assert.equal(seen, `/api/off/${EAN}`);
  assert.equal(init?.credentials, "omit");
  assert.deepEqual(r, { ok: true, product: good });

  const st = (s: number, body = "") => (async () => new Response(body, { status: s })) as unknown as typeof fetch;
  assert.deepEqual(await lookupOff(EAN, st(404)), { ok: false, code: "not_found" });
  assert.deepEqual(await lookupOff(EAN, st(503)), { ok: false, code: "unavailable" });
  assert.deepEqual(await lookupOff(EAN, st(200, "<html>")), { ok: false, code: "unavailable" });
  assert.deepEqual(await lookupOff(EAN, st(200, "{}")), { ok: false, code: "not_found" });
  const net = await lookupOff(EAN, (async () => {
    throw new TypeError("offline");
  }) as unknown as typeof fetch);
  assert.deepEqual(net, { ok: false, code: "unavailable" });
});
