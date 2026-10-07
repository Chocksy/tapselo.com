import assert from "node:assert/strict";
import { test } from "node:test";
import { barcodeApiBase, barcodeEndpoint, barcodeResultHtml, checkEan, DEFAULT_BARCODE_API, lookupBarcode, MESSAGES, stripPriceText } from "../src/lib/unelte/barcode.ts";

const BASE = "https://x.test/v1";
const EAN = "5901234123457";
const json = (body: unknown, status = 200) => async () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const status = (s: number) => async () => new Response("", { status: s });

test("barcodeEndpoint joins base and ean", () => {
  assert.equal(
    barcodeEndpoint("https://api.example.com/api/public/v1/", EAN),
    "https://api.example.com/api/public/v1/barcodes/5901234123457",
  );
});

test("barcodeApiBase: defaults to the same-origin /api endpoint, \"off\" hides the lookup", () => {
  assert.equal(DEFAULT_BARCODE_API, "/api");
  assert.equal(barcodeApiBase(undefined), "/api");
  assert.equal(barcodeApiBase(""), "/api");
  assert.equal(barcodeApiBase("  "), "/api");
  assert.equal(barcodeApiBase("https://x.test/v1/"), "https://x.test/v1");
  assert.equal(barcodeApiBase("/api/"), "/api");
  assert.equal(barcodeApiBase("off"), "");
  assert.equal(barcodeApiBase(" OFF "), "");
  assert.equal(barcodeEndpoint(barcodeApiBase(undefined), EAN), `/api/barcodes/${EAN}`);
});

test("checkEan: same rules as GET /api/barcodes/{ean} (EAN-13, no in-store 20–29 codes)", () => {
  assert.deepEqual(checkEan(" 5901234 123457 "), { ok: true, ean: EAN });
  assert.deepEqual(checkEan("590-1234-123457"), { ok: true, ean: EAN });
  assert.deepEqual(checkEan("036000291452"), { ok: true, ean: "0036000291452" });
  for (const bad of ["5901234123458", "96385074", "12345", "abc", ""]) {
    assert.deepEqual(checkEan(bad), { ok: false, code: "invalid", message: MESSAGES.invalid }, bad);
  }
  assert.deepEqual(checkEan("2000000000008"), { ok: false, code: "in_store", message: MESSAGES.in_store });
  assert.deepEqual(checkEan("2912345000011"), { ok: false, code: "in_store", message: MESSAGES.in_store });
  assert.match(MESSAGES.in_store, /20–29 sunt coduri interne de magazin/);
});

test("lookupBarcode: 400 / 404 / 429 / 5xx map to Romanian messages", async () => {
  const cases: [number, keyof typeof MESSAGES][] = [
    [400, "invalid"],
    [404, "not_found"],
    [429, "rate_limit"],
    [500, "bad_response"],
    [503, "bad_response"],
  ];
  for (const [s, code] of cases) {
    const r = await lookupBarcode(BASE, EAN, status(s));
    assert.equal(r.ok, false, String(s));
    if (!r.ok) {
      assert.equal(r.code, code, String(s));
      assert.equal(r.message, MESSAGES[code]);
    }
  }
  assert.match(MESSAGES.not_found, /^Nu am găsit produsul în baza de date Tapselo\./);
  assert.match(MESSAGES.invalid, /EAN-13 de 13 cifre/);
});

test("lookupBarcode: network error, timeout and invalid JSON", async () => {
  const net = await lookupBarcode(BASE, EAN, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(!net.ok && net.code, "network");

  const hang: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      // AbortSignal.timeout timers are unref'd; keep the event loop alive until the abort fires.
      const keepAlive = setTimeout(() => reject(new Error("timeout signal never fired")), 2000);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        reject(init.signal?.reason);
      });
    });
  const slow = await lookupBarcode(BASE, EAN, hang, 20);
  assert.equal(!slow.ok && slow.code, "network");

  const bad = await lookupBarcode(BASE, EAN, async () => new Response("<html>", { status: 200 }));
  assert.equal(!bad.ok && bad.code, "bad_response");
});

test("lookupBarcode: sends a credential-less GET", async () => {
  let seen: RequestInit | undefined;
  let seenUrl = "";
  await lookupBarcode(BASE, EAN, async (url, init) => {
    seenUrl = String(url);
    seen = init;
    return new Response("", { status: 404 });
  });
  assert.equal(seenUrl, `${BASE}/barcodes/${EAN}`);
  assert.equal(seen?.method, "GET");
  assert.equal(seen?.credentials, "omit");
});

test("lookupBarcode: keeps only ean, name, brand, category and vat_rate", async () => {
  const r = await lookupBarcode(
    BASE,
    EAN,
    json({ ean: EAN, name: " Telemea ", brand: "Local", category: "Lactate", vat_rate: 11, price: 24.8, shop_id: 7, stock: 3 }),
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.product, { ean: EAN, name: "Telemea", brand: "Local", category: "Lactate", vat_rate: 11 });
});

test("lookupBarcode: rejects rates that are not 21% or 11% and missing fields", async () => {
  for (const body of [
    { ean: EAN, name: "Carte", vat_rate: 0 },
    { ean: EAN, name: "Vechi", vat_rate: 19 },
    { ean: EAN, name: "Text", vat_rate: "21" },
    { ean: EAN, vat_rate: 21 },
    { name: "Fără EAN", vat_rate: 21 },
    null,
  ]) {
    const r = await lookupBarcode(BASE, EAN, json(body));
    assert.equal(!r.ok && r.code, "bad_response", JSON.stringify(body));
  }
});

test("barcodeResultHtml escapes every field from the API", () => {
  const evil = `<img src=x onerror="window.__xss=1">`;
  const html = barcodeResultHtml({ ean: EAN, name: evil, brand: evil, category: "<script>x</script>", vat_rate: 21 });
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=x onerror=&quot;window\.__xss=1&quot;&gt;/);
  assert.match(html, /<strong>21%<\/strong>/);
  assert.doesNotMatch(html, /pre[țt]|lei/i);
});

test("stripPriceText: shelf prices typed into catalog names are cut, sizes stay", () => {
  assert.equal(stripPriceText("COCA COLA 330ML 1L=9.39LEI"), "COCA COLA 330ML");
  assert.equal(stripPriceText("COCA COLA 1.25L 1L=4.72LEI"), "COCA COLA 1.25L");
  assert.equal(stripPriceText("SPRITE 2L 1L=3.40LEI"), "SPRITE 2L");
  assert.equal(stripPriceText("TELEMEA 400G 1KG = 32,50 LEI"), "TELEMEA 400G");
  assert.equal(stripPriceText("PAINE ALBA 500G - 4,99 lei"), "PAINE ALBA 500G");
  assert.equal(stripPriceText("APA 0,5L 2 RON"), "APA 0,5L");
  assert.equal(stripPriceText("FANTA 1,5L"), "FANTA 1,5L");
  assert.equal(stripPriceText("FANTA PORTOCALE DOZA 330ML"), "FANTA PORTOCALE DOZA 330ML");
  assert.equal(stripPriceText("LEIBNIZ BISCUITI 200G"), "LEIBNIZ BISCUITI 200G");
});

test("lookupBarcode: the live catalog name comes back without its price", async () => {
  const r = await lookupBarcode(BASE, "5449000000996", json({ ean: "5449000000996", name: "COCA COLA 330ML 1L=9.39LEI", vat_rate: 21 }));
  assert.equal(r.ok && r.product.name, "COCA COLA 330ML");
  const only = await lookupBarcode(BASE, EAN, json({ ean: EAN, name: "9.99 LEI", vat_rate: 21 }));
  assert.equal(only.ok && only.product.name, "Produs fără denumire");
});
