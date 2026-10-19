import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { purchaseSlipHtml } from "../src/lib/unelte/document-export.ts";
import { BLANK_PURCHASE_SLIP, purchaseSlipLineValue, purchaseSlipTotals } from "../src/lib/generators/purchase-slip.ts";
import type { PurchaseSlipPayload } from "../src/lib/generators/types.ts";

// Obviously fake data only: placeholder CIF and CNP made of zeros, invented names.
const SAMPLE: PurchaseSlipPayload = {
  company: "Magazin Exemplu SRL",
  company_tax_id: "RO00000000",
  company_trade_register: "J00/0000/2026",
  company_address: "Localitatea Test, Str. Exemplu nr. 1",
  company_county: "Județul Test",
  doc_number: "7",
  date: "2026-10-19",
  seller_name: "Ion Exemplu",
  seller_address: "Localitatea Demo, Str. Probă nr. 2",
  seller_id_type: "CI",
  seller_id_series: "XX",
  seller_id_number: "000000",
  seller_cnp: "0000000000000",
  lines: [
    { name: "Cupru (deșeu)", unit: "kg", quantity: 12.5, unit_price: 31.2 },
    { name: "Scaun lemn", code: "S-01", unit: "buc", quantity: 2, unit_price: 45 },
  ],
  buyer_name: "Ana Test",
  storekeeper_name: "Maria Test",
};

const EVIL = `"><script>window.__xss=1</script><img src=x onerror=alert(1)>`;
const FORBIDDEN = /\b(certificat Datecs|avizat|omologat|fără driver|fără tehnician)\b/i;
const CEDILLA = /[şţŞŢ]/;
const main = (html: string) => html.slice(html.indexOf("<main"));

test("borderou: valori pe linie, total, impozit reținut și rest de plată", () => {
  assert.equal(purchaseSlipLineValue({ name: "x", unit: "kg", quantity: 1.333, unit_price: 3 }), 4);
  assert.equal(purchaseSlipLineValue({ name: "x", unit: "buc", quantity: 3, unit_price: 1.005 }), 3.02);
  const t = purchaseSlipTotals(SAMPLE);
  assert.deepEqual(t.line_values, [390, 90]);
  assert.equal(t.total, 480);
  assert.equal(t.withholding, 0);
  assert.equal(t.net_payable, 480);
  assert.equal(t.quantity, null, "unități diferite: fără total de cantitate");
  const metal = purchaseSlipTotals({ lines: [{ name: "Aluminiu", unit: "kg", quantity: 7.25, unit_price: 5.55 }, { name: "Aluminiu", unit: "KG", quantity: 1, unit_price: 0.01 }], withholding_percent: 10 });
  assert.equal(metal.total, 40.25);
  assert.equal(metal.withholding, 4.03);
  assert.equal(metal.net_payable, 36.22);
  assert.equal(metal.quantity, 8.25);
});

test("borderou completat A4: rubricile modelului 14-4-13, vânzător, total, semnături", () => {
  const html = purchaseSlipHtml(SAMPLE);
  assert.match(html, /@page\{size:A4;/);
  assert.match(html, /Borderou de achiziție<\/h1>/);
  assert.match(html, /nr\. 7 data 19\.10\.2026/);
  assert.match(html, /Cod formular 14-4-13 \(OMFP nr\. 2\.634\/2015, Anexa nr\. 3\)/);
  for (const label of ["Entitatea:", "Codul de identificare fiscală:", "Numărul de înmatriculare în Registrul comerțului/anul:", "Județul:"]) {
    assert.ok(html.includes(`<b>${label}</b>`), label);
  }
  assert.match(html, /RO00000000/);
  assert.match(html, /<th>Produsul<\/th><th>Cod<\/th><th>U\/M<\/th><th>Cantitate<\/th><th>Preț unitar de achiziție<\/th><th>Valoarea achiziției<\/th>/);
  assert.match(html, /<td class="num">12,5<\/td>\n<td class="num">31,20<\/td>\n<td class="num">390,00<\/td>/);
  assert.match(html, /<tfoot><tr><td>TOTAL<\/td><td class="x">X<\/td><td class="x">X<\/td><td class="num"><\/td><td><\/td><td class="num">480,00<\/td>/);
  assert.match(html, /Vânzător \(persoană fizică\)/);
  assert.match(html, /CI seria XX nr\. 000000/);
  assert.match(html, /Rubrică suplimentară: modelul 14-4-13 nu are câmpuri pentru vânzător/);
  assert.match(html, /Semnătura achizitorului<span>Ana Test, semnătura/);
  assert.match(html, /Semnătura gestionarului<span>Maria Test, semnătura/);
  assert.doesNotMatch(html, /Impozit pe venit reținut/, "fără procent nu apare tabelul de plată");
  assert.match(html, /utm_source=unelte&amp;utm_medium=document&amp;utm_campaign=g_purchase_slip/);
  assert.doesNotMatch(html, CEDILLA);
});

test("borderou A5 cu impozit reținut și câmpuri opționale goale", () => {
  const { seller_cnp: _c, seller_address: _a, company_trade_register: _r, ...rest } = SAMPLE;
  const html = purchaseSlipHtml({ ...rest, withholding_percent: 10 }, "A5");
  assert.match(html, /@page\{size:A5;margin:8mm\}/);
  assert.match(html, /<main class="sheet a5">/);
  assert.match(html, /Impozit pe venit reținut la sursă \(10%\)<\/td><td class="num">48,00 lei/);
  assert.match(html, /Suma de plată vânzătorului<\/td><td class="num">432,00 lei/);
  assert.doesNotMatch(main(html), /CNP|Domiciliul|Registrul comerțului/);
});

test("borderou necompletat: structura modelului, fără date, A4 14 rânduri și A5 7", () => {
  const a4 = purchaseSlipHtml(BLANK_PURCHASE_SLIP, "A4", true);
  const a5 = purchaseSlipHtml(BLANK_PURCHASE_SLIP, "A5", true);
  for (const html of [a4, a5]) {
    for (const label of ["Entitatea:", "Codul de identificare fiscală:", "Sediul (localitatea, str., număr):", "Județul:", "Numele și prenumele", "CNP", "Semnătura achizitorului", "Semnătura gestionarului"]) {
      assert.ok(html.includes(label), label);
    }
    assert.match(html, /<td class="x">X<\/td><td class="x">X<\/td>/);
    assert.doesNotMatch(main(html), /\d+,\d{2}/, "niciun număr pe formularul gol");
    assert.doesNotMatch(html, CEDILLA);
  }
  const rows = (html: string) => (main(html).split("<tbody>")[2]?.split("</tbody>")[0].match(/<tr>/g) ?? []).length;
  assert.equal(rows(a4), 14);
  assert.equal(rows(a5), 7);
});

test("borderou: escapează textul utilizatorului", () => {
  const html = purchaseSlipHtml({ ...SAMPLE, company: EVIL, seller_name: EVIL, lines: [{ name: EVIL, code: EVIL, unit: EVIL, quantity: 1, unit_price: 1 }], buyer_name: EVIL });
  assert.doesNotMatch(main(html), /<script>window|<img src=x/);
  assert.match(html, /&lt;script&gt;window\.__xss=1&lt;\/script&gt;/);
});

test("borderou: formularele goale statice există (A4, A5, preview)", () => {
  for (const f of ["a4.pdf", "a5.pdf", "preview.png"]) {
    const path = join(process.cwd(), "public/unelte/formulare", `borderou-de-achizitie-14-4-13-${f}`);
    assert.ok(existsSync(path), path);
    assert.ok(readFileSync(path).length > 10_000, path);
  }
  assert.equal(readFileSync(join(process.cwd(), "public/unelte/formulare/borderou-de-achizitie-14-4-13-a4.pdf")).subarray(0, 5).toString(), "%PDF-");
});

test("pagina construită: title, H1, canonical, JSON-LD, surse, NIR, copy", () => {
  const html = readFileSync(join(process.cwd(), "dist/unelte/generator-borderou-de-achizitie/index.html"), "utf8");
  assert.match(html, /<title>Borderou de achiziție — model 14-4-13 PDF gratuit \| Tapselo<\/title>/);
  assert.match(html, /<h1[^>]*>Borderou de achiziție de la persoane fizice<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/generator-borderou-de-achizitie\/">/);
  const types = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return (Array.isArray(data) ? data : data["@graph"] ?? [data]).map((d: { "@type": string }) => d["@type"]);
  });
  for (const t of ["WebApplication", "FAQPage", "BreadcrumbList"]) assert.ok(types.includes(t), t);
  assert.match(html, /href="\/unelte\/generator-nir\/"/);
  for (const id of ["286044", "286045", "286046", "162616", "171282", "307847"]) {
    assert.ok(html.includes(`https://legislatie.just.ro/Public/DetaliiDocument/${id}`), id);
  }
  assert.match(html, /gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  assert.doesNotMatch(text, CEDILLA);
  assert.doesNotMatch(text, FORBIDDEN);
});

test("pagina NIR trimite la borderou și indexul /unelte/ îl listează", () => {
  const nir = readFileSync(join(process.cwd(), "dist/unelte/generator-nir/index.html"), "utf8");
  assert.match(nir, /href="\/unelte\/generator-borderou-de-achizitie\/"/);
  const index = readFileSync(join(process.cwd(), "dist/unelte/index.html"), "utf8");
  assert.match(index, /href="\/unelte\/generator-borderou-de-achizitie\/?"/);
});
