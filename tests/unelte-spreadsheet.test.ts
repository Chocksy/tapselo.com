import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { cashbookRows, cashbookXlsx } from "../src/lib/unelte/spreadsheet.ts";
import type { CashbookPayload } from "../src/lib/generators/types.ts";

const PAYLOAD: CashbookPayload = {
  company: "Test & Fiii SRL",
  date: "2026-03-01",
  opening_balance: 1250.4,
  entries: [
    { doc: "Z 0412", annexes: "1", description: "Încasări din vânzări, raport Z", receipt: 3480.2 },
    { doc: "DP 18", description: "Plată furnizor <Lactate>", payment: 1120 },
  ],
};

function sheet(p: CashbookPayload): string {
  const files = unzipSync(cashbookXlsx(p));
  for (const f of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"]) {
    assert.ok(files[f], f);
  }
  return strFromU8(files["xl/worksheets/sheet1.xml"]);
}

test("xlsx: valid OOXML package with form 14-4-7A headings", () => {
  const xml = sheet(PAYLOAD);
  assert.match(xml, /^<\?xml/);
  for (const h of ["Registrul de casă", "Contul:", "5311 Casa în lei", "Nr. crt.", "Nr. act casă", "Nr. anexe", "Explicații", "Încasări", "Plăți", "Sold", "Report/Sold ziua precedentă", "TOTAL", "Sold final"]) {
    assert.ok(xml.includes(`>${h}</t>`), h);
  }
  assert.match(xml, /Casier \(nume, prenume, semnătura\)/);
  assert.match(xml, /Compartiment financiar-contabil/);
});

test("xlsx: amounts are numeric cells with a 2-decimal format", () => {
  const xml = sheet(PAYLOAD);
  assert.match(xml, /<c r="G6" s="2"><v>1250\.4<\/v><\/c>/);
  assert.match(xml, /<c r="E7" s="2"><v>3480\.2<\/v><\/c>/);
  assert.match(xml, /<c r="G7" s="2"><v>4730\.6<\/v><\/c>/);
  assert.match(xml, /<c r="F8" s="2"><v>1120<\/v><\/c>/);
  assert.match(xml, /<c r="E9" s="3"><v>3480\.2<\/v><\/c><c r="F9" s="3"><v>1120<\/v><\/c>/);
  assert.match(xml, /<c r="G10" s="3"><v>3610\.6<\/v><\/c>/);
  assert.doesNotMatch(xml, /3\.480,20/);
  const styles = strFromU8(unzipSync(cashbookXlsx(PAYLOAD))["xl/styles.xml"]);
  assert.match(styles, /<xf numFmtId="4"/);
});

test("xlsx: Nr. anexe, escaping and warnings", () => {
  const xml = sheet(PAYLOAD);
  assert.match(xml, /<c r="C7" t="inlineStr"><is><t xml:space="preserve">1<\/t><\/is><\/c>/);
  assert.match(xml, /Test &amp; Fiii SRL/);
  assert.match(xml, /Plată furnizor &lt;Lactate&gt;/);
  assert.doesNotMatch(xml, /Atenție/);

  const over = sheet({ ...PAYLOAD, opening_balance: 60000 });
  assert.match(over, /Atenție: Soldul final \(62\.360,20 lei\) depășește plafonul de casă de 50\.000,00 lei\./);
  const neg = sheet({ ...PAYLOAD, opening_balance: 0, entries: [{ doc: "DP", description: "x", payment: 5 }] });
  assert.match(neg, /Atenție: Soldul devine negativ după înregistrarea 1\./);
});

test("cashbookRows: one row per entry, balances as numbers", () => {
  const { rows } = cashbookRows(PAYLOAD);
  const entry = rows.find((r) => r[1] === "DP 18")!;
  assert.deepEqual(entry, [2, "DP 18", null, "Plată furnizor <Lactate>", null, 1120, 3610.6]);
});
