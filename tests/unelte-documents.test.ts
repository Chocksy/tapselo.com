import assert from "node:assert/strict";
import { test } from "node:test";
import { cashbookHtml, nirHtml } from "../src/lib/unelte/document-export.ts";

const EVIL = `"><script>window.__xss=1</script><img src=x onerror=alert(1)>`;

function main(html: string): string {
  return html.slice(html.indexOf("<main"));
}

test("local registru: Romanian shell, no abuse line, unelte UTM, Nr. anexe", () => {
  const html = cashbookHtml({
    company: "Magazin Ana SRL",
    date: "2026-10-07",
    opening_balance: 100,
    entries: [{ doc: "Z 12", annexes: "2", description: "Încasări raport Z", receipt: 3480.2 }],
  });
  assert.match(html, /<html lang="ro">/);
  assert.match(html, /Află mai mult/);
  assert.match(html, /Printează \/ Salvează PDF/);
  assert.match(html, /utm_source=unelte&amp;utm_medium=document&amp;utm_campaign=g_cashbook/);
  assert.doesNotMatch(html, /Raportează abuz|Expiră pe|utm_source=ai-plugin/);
  assert.match(html, /<td class="ctr">2<\/td>/);
  assert.match(html, /<td class="num">3\.480,20<\/td>/);
  assert.match(html, /<td class="num">3\.580,20<\/td>/);
});

test("local NIR: NIR number and date, received quantities, no abuse line", () => {
  const html = nirHtml({
    company: "Magazin Ana SRL",
    company_tax_id: "RO123",
    supplier: "Furnizor SA",
    invoice_number: "F 1",
    invoice_date: "2026-10-06",
    nir_number: "5",
    nir_date: "2026-10-07",
    markup_percent: 25,
    lines: [{ name: "Lapte", unit: "buc", quantity: 10, quantity_received: 9, unit_cost: 5, vat_rate: 11 }],
  });
  assert.match(html, /<b>NIR nr\.:<\/b> 5/);
  assert.match(html, /<b>Data NIR:<\/b> 07\.10\.2026/);
  assert.match(html, /<td class="num">10<\/td>\n<td class="num">9<\/td>\n<td class="num">5,00<\/td>\n<td class="num">45,00<\/td>/);
  assert.match(html, /Diferențe la recepție/);
  assert.doesNotMatch(html, /Raportează abuz|Expiră pe/);
});

test("local documents escape every user field", () => {
  const cb = cashbookHtml({
    company: EVIL,
    date: "2026-10-07",
    opening_balance: 0,
    entries: [{ doc: EVIL, annexes: EVIL, description: EVIL, receipt: 1 }],
  });
  const nir = nirHtml({
    company: EVIL,
    company_tax_id: EVIL,
    supplier: EVIL,
    supplier_tax_id: EVIL,
    invoice_number: EVIL,
    invoice_date: "2026-10-07",
    nir_number: EVIL,
    management: EVIL,
    markup_percent: 25,
    lines: [{ name: EVIL, unit: EVIL, quantity: 1, unit_cost: 1, vat_rate: 21 }],
  });
  for (const html of [cb, nir]) {
    assert.doesNotMatch(main(html), /<script>window|<img src=x/);
    assert.match(main(html), /&lt;script&gt;window\.__xss=1&lt;\/script&gt;/);
    assert.equal(html.split("<script>").length - 1, 1);
  }
});
