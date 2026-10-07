import assert from "node:assert/strict";
import { test } from "node:test";
import { barcodeEndpoint, lookupBarcode } from "../src/lib/unelte/barcode.ts";

test("barcodeEndpoint joins base and ean", () => {
  assert.equal(
    barcodeEndpoint("https://api.example.com/api/public/v1/", "5901234123457"),
    "https://api.example.com/api/public/v1/barcodes/5901234123457",
  );
});

test("lookupBarcode: 404 and 429 messages in Romanian", async () => {
  const fetch404 = async () => new Response("", { status: 404 });
  const r404 = await lookupBarcode("https://x.test/v1", "5901234123457", fetch404);
  assert.equal(r404.ok, false);
  if (!r404.ok) assert.equal(r404.code, "not_found");

  const fetch429 = async () => new Response("", { status: 429 });
  const r429 = await lookupBarcode("https://x.test/v1", "5901234123457", fetch429);
  assert.equal(r429.ok, false);
  if (!r429.ok) assert.equal(r429.code, "rate_limit");
});

test("lookupBarcode: parses product without prices", async () => {
  const body = JSON.stringify({
    ean: "5901234123457",
    name: "Telemea",
    brand: "Local",
    category: "Lactate",
    vat_rate: 11,
  });
  const fetchOk = async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
  const r = await lookupBarcode("https://x.test/v1", "5901234123457", fetchOk);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.product.name, "Telemea");
    assert.equal(r.product.vat_rate, 11);
  }
});
