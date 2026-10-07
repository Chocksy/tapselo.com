import assert from "node:assert/strict";
import { test } from "node:test";
import { renderAfisHtml } from "../src/lib/unelte/markup-afis.ts";
import { calculateShelfPrice } from "../src/lib/mcp/answers/shelf-price.ts";

const price = calculateShelfPrice({ cost: 10, markup_percent: 30, vat_rate: 11, rounding: "none" });

test("poster shows the sale price and VAT, but not cost or markup by default", () => {
  const html = renderAfisHtml({ productName: "Pâine albă", storeName: "Magazin Ana", price });
  assert.match(html, /<h1 class="doc-title">Informare preț<\/h1>/);
  assert.match(html, /Pâine albă/);
  assert.match(html, /<td>Preț de vânzare \(cu TVA\)<\/td><td class="num"><b>14,43 lei<\/b><\/td>/);
  assert.match(html, /<td>TVA 11%<\/td>/);
  assert.match(html, /<td>Preț fără TVA<\/td><td class="num">13,00 lei<\/td>/);
  assert.doesNotMatch(html, /Cost de achiziție|Adaos comercial|10,00 lei|30,00%/);
  assert.doesNotMatch(html, /plafon|OUG/);
});

test("poster prints cost and markup only when the owner opts in", () => {
  const html = renderAfisHtml({ productName: "Pâine", storeName: "Magazin", price, showCost: true, showMarkup: true });
  assert.match(html, /<td>Cost de achiziție \(fără TVA\)<\/td><td class="num">10,00 lei<\/td>/);
  assert.match(html, /<td>Adaos comercial<\/td><td class="num">30,00%<\/td>/);
  const costOnly = renderAfisHtml({ productName: "Pâine", storeName: "Magazin", price, showCost: true });
  assert.match(costOnly, /Cost de achiziție/);
  assert.doesNotMatch(costOnly, /Adaos comercial/);
});

test("poster is a local document: no abuse line, unelte UTM", () => {
  const html = renderAfisHtml({ productName: "Pâine", storeName: "Magazin", price });
  assert.doesNotMatch(html, /Raportează abuz|Expiră pe/);
  assert.match(html, /utm_source=unelte&amp;utm_medium=document/);
  assert.match(html, /Afiș informativ\. Prețul plătit la casă este același cu prețul de la raft\./);
});

test("poster escapes user text", () => {
  const evil = `"><script>window.__xss=1</script><img src=x onerror=alert(1)>`;
  const html = renderAfisHtml({ productName: evil, storeName: evil, price });
  const body = html.slice(html.indexOf("<main"));
  assert.doesNotMatch(body, /<script>window|<img src=x/);
  assert.match(body, /&lt;script&gt;window\.__xss=1&lt;\/script&gt;/);
});
