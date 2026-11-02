import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BLANK_PV_ANULARE, pvAnulareBonDocxBlocks } from "../src/lib/generators/pv-anulare-bon.ts";
import type { PvAnulareBonPayload } from "../src/lib/generators/types.ts";
import { buildMinimalDocx } from "../src/lib/unelte/minimal-docx.ts";
import { pvAnulareBonHtml } from "../src/lib/unelte/document-export.ts";

const SAMPLE: PvAnulareBonPayload = {
  company: "Magazin Exemplu SRL",
  company_tax_id: "RO00000000",
  workplace: "Punct central",
  amef_model: "Datecs FP-700",
  amef_series: "AB123456",
  receipt_number: "42",
  receipt_date: "2026-11-01",
  receipt_time: "14:35",
  receipt_amount: 19.99,
  products_wrong: "Lapte 1L",
  motiv: "pret_gresit",
  sesizare_name: "Ion Exemplu",
  sesizare_role: "Casier",
  sesizare_date: "2026-11-02",
  decizie_name: "Maria Test",
  decizie_role: "Contabil-șef",
  decizie_date: "2026-11-02",
  checklist_nir_attached: true,
  checklist_nota_contabila: false,
};

const EVIL = `"><script>window.__xss=1</script>`;
const CEDILLA = /[şţŞŢ]/;
const FORBIDDEN = /\b(certificat Datecs|avizat|omologat)\b/i;
const PAGE = "unelte/proces-verbal-anulare-bon-fiscal";
const S1 = "https://legislatie.just.ro/Public/DetaliiDocument/266909";
const S2 = "https://legislatie.just.ro/Public/DetaliiDocument/263545";

test("pv anulare: HTML completat cu sesizare, decizie, checklist și UTM", () => {
  const html = pvAnulareBonHtml(SAMPLE);
  assert.match(html, /@page\{size:A4;/);
  assert.match(html, /Sesizare scrisă \(art\. 36 lit\. a\)\)/);
  assert.match(html, /Decizie scrisă de aprobare \(art\. 36 lit\. b\)\)/);
  assert.match(html, /Bon fiscal nr\./);
  assert.match(html, /14:35/);
  assert.match(html, /☑.*art\. 36 lit\. c\)/);
  assert.match(html, /☐.*art\. 36 lit\. d\)/);
  assert.match(html, /utm_source=unelte&amp;utm_medium=document&amp;utm_campaign=g_pv_anulare_bon/);
  assert.doesNotMatch(html, CEDILLA);
});

test("pv anulare: formular gol și escape XSS", () => {
  const blank = pvAnulareBonHtml(BLANK_PV_ANULARE, true);
  assert.match(blank, /model necompletat/i);
  assert.doesNotMatch(blank, /Magazin Exemplu/);
  const html = pvAnulareBonHtml({ ...SAMPLE, company: EVIL, products_wrong: EVIL });
  assert.doesNotMatch(html, /<script>window/);
  assert.match(html, /&lt;script&gt;/);
});

test("pv anulare: docx minim valid (PK zip)", () => {
  const bytes = buildMinimalDocx(pvAnulareBonDocxBlocks(SAMPLE));
  assert.equal(String.fromCharCode(...bytes.subarray(0, 2)), "PK");
  assert.ok(bytes.length > 500);
});

test("pv anulare: formulare statice PDF, Word, preview", () => {
  const dir = join(process.cwd(), "public/unelte/formulare");
  for (const f of ["proces-verbal-anulare-bon-fiscal-a4.pdf", "proces-verbal-anulare-bon-fiscal.docx", "proces-verbal-anulare-bon-fiscal-preview.png"]) {
    const path = join(dir, f);
    assert.ok(existsSync(path), path);
    assert.ok(readFileSync(path).length > 1000, f);
  }
  assert.equal(readFileSync(join(dir, "proces-verbal-anulare-bon-fiscal-a4.pdf")).subarray(0, 5).toString(), "%PDF-");
});

test("pagina construită: title, H1, canonical, JSON-LD, surse, linkuri", () => {
  const html = readFileSync(join(process.cwd(), "dist", PAGE, "index.html"), "utf8");
  assert.match(html, /<title>Proces verbal anulare bon fiscal — generator gratuit PDF \| Tapselo<\/title>/);
  assert.match(html, /<h1[^>]*>Proces verbal de anulare bon fiscal \(dosar art\. 36, HG 479\/2003\)<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/proces-verbal-anulare-bon-fiscal\/">/);
  const types = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return (Array.isArray(data) ? data : data["@graph"] ?? [data]).map((d: { "@type": string }) => d["@type"]);
  });
  for (const t of ["WebApplication", "FAQPage", "BreadcrumbList"]) assert.ok(types.includes(t), t);
  assert.ok(html.includes(S1));
  assert.ok(html.includes(S2));
  assert.match(html, /accesat la 02\.11\.2026/);
  assert.match(html, /id="surse"/);
  assert.match(html, /href="\/unelte\/dispozitie-de-plata\/"/);
  assert.match(html, /href="\/ghid\/erori-datecs\/"/);
  assert.match(html, /gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  assert.doesNotMatch(text, CEDILLA);
  assert.doesNotMatch(text, FORBIDDEN);
});

test("index /unelte/ și sitemap listeză pagina", () => {
  const index = readFileSync(join(process.cwd(), "dist/unelte/index.html"), "utf8");
  assert.match(index, /href="\/unelte\/proces-verbal-anulare-bon-fiscal\/?"/);
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/tapselo\.com\/unelte\/proces-verbal-anulare-bon-fiscal\/<\/loc>/);
});
