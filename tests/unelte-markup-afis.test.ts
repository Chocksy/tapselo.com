import assert from "node:assert/strict";
import { test } from "node:test";
import { foodMarkupWarning, renderAfisHtml } from "../src/lib/unelte/markup-afis.ts";
import { calculateShelfPrice } from "../src/lib/mcp/answers/shelf-price.ts";

test("foodMarkupWarning above 300%", () => {
  assert.equal(foodMarkupWarning(250), null);
  assert.match(foodMarkupWarning(350)!, /300/);
});

test("renderAfisHtml contains price not raw cost leak", () => {
  const price = calculateShelfPrice({ cost: 10, markup_percent: 30, vat_rate: 11, rounding: "none" });
  const html = renderAfisHtml({ productName: "Pâine", storeName: "Magazin", price, foodRetail: true });
  assert.match(html, /Pâine/);
  assert.match(html, /Informare preț/);
});
