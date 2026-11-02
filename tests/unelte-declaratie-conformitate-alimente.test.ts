import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { VOLUNTARY_NOTICE } from "../src/lib/unelte/declaratie-conformitate-alimente.ts";
import { foodConformityHtml } from "../src/lib/unelte/document-export.ts";
import { foodConformityDocx } from "../src/lib/unelte/food-conformity-docx.ts";
import type { FoodConformityPayload } from "../src/lib/generators/types.ts";

const SAMPLE: FoodConformityPayload = {
  producer_name: "Patiserie Exemplu SRL",
  producer_tax_id: "RO12345678",
  producer_address: "Localitatea Test, Str. Exemplu nr. 1",
  product_name: "Tort simplu",
  product_code: "T-001",
  batch_lot: "L2026/11",
  manufacture_date: "2026-11-01",
  ingredients: "făină, zahăr, ouă, unt",
  allergen_ids: ["gluten", "oua", "lapte"],
  shelf_life_kind: "ddm",
  shelf_life_date: "2026-11-05",
  storage_conditions: "la +4 °C",
  reference_document: "Rețetă internă nr. 12 / 2026",
  buyer_name: "Magazin Demo SRL",
  place: "București",
  declaration_date: "2026-11-02",
  signatory_name: "Ion Exemplu",
  signatory_role: "administrator",
};

const EVIL = `"><script>window.__xss=1</script>`;
const CEDILLA = /[şţŞŢ]/;
const FORBIDDEN = /\b(certificat Datecs|avizat|omologat|ANSVSA aprobat|fără driver|fără tehnician)\b/i;

test("declarație alimente: HTML conține date, alergeni, fără XSS", () => {
  const html = foodConformityHtml({ ...SAMPLE, product_name: EVIL });
  assert.match(html, /Declarație de conformitate<\/h1>/);
  assert.match(html, /Patiserie Exemplu SRL/);
  assert.match(html, /Ouă și produse derivate/);
  assert.match(html, /Data durabilității minimă: 05\.11\.2026/);
  assert.match(html, /Rețetă internă nr\. 12 \/ 2026/);
  assert.match(html, /utm_source=unelte&amp;utm_medium=document&amp;utm_campaign=g_food_conformity/);
  assert.doesNotMatch(html, /<script>window\.__xss/);
  assert.doesNotMatch(html, CEDILLA);
});

test("declarație alimente: DOCX este zip OOXML valid", () => {
  const buf = foodConformityDocx(SAMPLE);
  assert.ok(buf.length > 200);
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);
});

test("aviz voluntary notice constant matches brief", () => {
  assert.equal(VOLUNTARY_NOTICE.startsWith("Nicio lege nu obligă"), true);
  assert.match(VOLUNTARY_NOTICE, /declarație voluntară/);
  assert.match(VOLUNTARY_NOTICE, /Nu înlocuiește etichetarea/);
});

const dist = (p: string) => readFileSync(join(process.cwd(), "dist", p, "index.html"), "utf8");
const PAGE = "unelte/declaratie-de-conformitate-produse-alimentare";

test("pagina declarație: notice deasupra formularului, title, JSON-LD", () => {
  const html = dist(PAGE);
  const noticeIdx = html.indexOf("fcd-voluntary-notice");
  const toolIdx = html.indexOf("id=\"fcd-tool\"");
  assert.ok(noticeIdx > 0 && toolIdx > noticeIdx, "notice must appear above the form");
  assert.ok(html.includes(VOLUNTARY_NOTICE));
  assert.match(html, /<title>Declarație de conformitate produse alimentare — model gratuit \(patiserie, prăjituri, torturi\) \| Tapselo<\/title>/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/declaratie-de-conformitate-produse-alimentare\/">/,
  );
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  assert.equal(app?.url, "https://tapselo.com/unelte/declaratie-de-conformitate-produse-alimentare/");
  assert.ok(blocks.some((b) => b["@type"] === "FAQPage"));
});

test("pagina declarație: surse, fără promisiuni interzise, preț canon", () => {
  const html = dist(PAGE);
  assert.match(html, /70574/);
  assert.match(html, /267003/);
  assert.match(html, /evaluarea conformității produselor/);
  assert.match(html, /Art\. 53 cere declarația/);
  assert.match(html, /101005/);
  assert.match(html, /eur-lex\.europa\.eu\/eli\/reg\/2011\/1169/);
  assert.match(html, /eur-lex\.europa\.eu\/eli\/reg\/2004\/1935/);
  assert.match(html, /accesat la 02\.11\.2026/);
  assert.match(html, /Nu este consultanță juridică/);
  assert.match(html, /gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, FORBIDDEN);
  assert.doesNotMatch(text, CEDILLA);
});

test("declarație: legată din /unelte/ și sitemap", () => {
  assert.ok(dist("unelte").includes('href="/unelte/declaratie-de-conformitate-produse-alimentare/"'));
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/tapselo\.com\/unelte\/declaratie-de-conformitate-produse-alimentare\/<\/loc>/);
});
