import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { avizHtml } from "../src/lib/unelte/document-export.ts";
import { AVIZ_MENTIONS, BLANK_AVIZ, BLANK_ROWS, avizTotal } from "../src/lib/generators/aviz.ts";
import type { AvizPayload } from "../src/lib/generators/types.ts";

// Fake parties only: obviously invented names and CUIs, never real company data.
const SAMPLE: AvizPayload = {
  supplier: {
    name: "Magazin Exemplu SRL",
    tax_id: "RO12345678",
    trade_register: "J40/0000/2026",
    share_capital: "200 lei",
    address: "Localitatea Test, Str. Exemplu nr. 1",
    county: "Ilfov",
  },
  buyer: { name: "Client Demo SRL", tax_id: "RO87654321", address: "Localitatea Demo, Str. Probă nr. 2", county: "Cluj" },
  doc_number: "0012",
  date: "2026-10-19",
  mention: AVIZ_MENTIONS.transfer,
  lines: [
    { name: "Apă minerală 2 l", unit: "buc", quantity: 24, unit_price: 2.5 },
    { name: "Lăzi plastic (ambalaj)", unit: "buc", quantity: 2, unit_price: 10 },
  ],
  delegate_name: "Ion Exemplu",
  delegate_id_series: "XX",
  delegate_id_number: "000000",
  vehicle: "autoutilitară",
  vehicle_number: "B-00-XXX",
  dispatch_date: "2026-10-19",
  dispatch_time: "09:30",
};

const EVIL = `"><script>window.__xss=1</script><img src=x onerror=alert(1)>`;
const FORBIDDEN = /\b(certificat Datecs|avizat|omologat|fără driver|fără tehnician)\b/i;
const CEDILLA = /[şţŞŢ]/;

function main(html: string): string {
  return html.slice(html.indexOf("<main"));
}

test("aviz 14-3-6A completat: părți, mențiune, linii, total, expediție, UTM unelte", () => {
  const html = avizHtml(SAMPLE);
  assert.match(html, /@page\{size:A4;/);
  assert.match(html, /Aviz de însoțire a mărfii<\/h1>/);
  assert.match(html, /Cod formular 14-3-6A \(OMFP nr\. 2\.634\/2015, Anexa nr\. 3\)/);
  assert.match(html, /<b>Furnizor:<\/b> Magazin Exemplu SRL/);
  assert.match(html, /<b>Cumpărător:<\/b> Client Demo SRL/);
  assert.match(html, /Cod de identificare fiscală: RO12345678/);
  assert.match(html, /Capital social: 200 lei/);
  assert.match(html, /<p class="mention">Fără factură<\/p>/);
  assert.match(html, /<b>Nr\.<\/b> 0012/);
  assert.match(html, /19\.10\.2026/);
  assert.match(html, /<td class="num">24<\/td>\n<td class="num">2,50<\/td>\n<td class="num">60,00<\/td>/);
  assert.match(html, /<td class="num tot">80,00<\/td>/);
  assert.match(html, /Numele delegatului: Ion Exemplu/);
  assert.match(html, /Mijlocul de transport autoutilitară nr\. B-00-XXX/);
  assert.match(html, /la data de 19\.10\.2026 ora 09:30/);
  assert.match(html, /Semnătura reprezentant furnizor/);
  assert.match(html, /Semnătura de primire/);
  assert.match(html, /utm_source=unelte&amp;utm_medium=document&amp;utm_campaign=g_aviz/);
  assert.doesNotMatch(html, /Raportează abuz|Expiră pe/);
  assert.doesNotMatch(html, CEDILLA);
});

test("aviz fără prețuri: coloanele 4-5 și TOTAL rămân goale, cu nota despre alt document", () => {
  const lines = SAMPLE.lines.map(({ unit_price: _p, ...l }) => l);
  const html = avizHtml({ ...SAMPLE, lines }, "A5");
  assert.match(html, /@page\{size:A5;margin:8mm\}/);
  assert.match(html, /<main class="sheet a5">/);
  assert.match(html, /<td class="num tot"><\/td>/);
  assert.match(html, /se regăsesc în alt document justificativ/);
  assert.equal(avizTotal(lines), null);
  assert.equal(avizTotal([{ name: "x", unit: "buc", quantity: 3, unit_price: 1.005 }]), 3.02);
  assert.equal(avizTotal([]), null);
});

test("aviz necompletat: structura modelului 14-3-6A, fără date, A4 și A5", () => {
  for (const size of ["A4", "A5"] as const) {
    const html = avizHtml({ ...SAMPLE, ...BLANK_AVIZ, mention: "NU APARE", delegate_name: "NU APARE" }, size, true);
    assert.match(html, new RegExp(`@page\\{size:${size};`));
    for (const label of [
      "Furnizor:",
      "Cumpărător:",
      "(denumirea, forma juridică)",
      "Nr. de înmatriculare în Registrul comerțului/anul:",
      "Cod de identificare fiscală:",
      "Sediul (localitatea, str., nr.):",
      "Județul:",
      "Data</b> (ziua, luna, anul)",
      "Mențiune:",
      "Nr. crt.",
      "Specificația (produse, ambalaje etc.)",
      "U/M",
      "Cantitatea livrată",
      "Prețul unitar (fără TVA) - lei -",
      "Valoarea - lei -",
      "TOTAL",
      "Semnătura reprezentant furnizor",
      "Date privind expediția",
      "Numele delegatului:",
      "Cartea de identitate seria",
      "eliberat/ă",
      "Mijlocul de transport",
      "Expedierea s-a efectuat în prezența noastră la data de",
      "Semnăturile",
      "Semnătura de primire",
      "Cod formular 14-3-6A",
    ]) {
      assert.ok(html.includes(label), `${size}: lipsește ${label}`);
    }
    const rows = main(html).match(/<tr><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><\/tr>/g) ?? [];
    assert.equal(rows.length, BLANK_ROWS[size]);
    assert.doesNotMatch(html, /NU APARE|RO12345678|Magazin Exemplu|Capital social/);
  }
});

test("aviz: fiecare câmp al utilizatorului este escapat", () => {
  const party = { name: EVIL, tax_id: EVIL, trade_register: EVIL, share_capital: EVIL, address: EVIL, county: EVIL };
  const html = avizHtml({
    supplier: party,
    buyer: party,
    doc_number: EVIL,
    date: "2026-10-19",
    mention: EVIL,
    lines: [{ name: EVIL, unit: EVIL, quantity: 1, unit_price: 1 }],
    delegate_name: EVIL,
    delegate_id_series: EVIL,
    delegate_id_number: EVIL,
    delegate_id_issuer: EVIL,
    vehicle: EVIL,
    vehicle_number: EVIL,
    dispatch_time: EVIL,
  });
  assert.doesNotMatch(main(html), /<script>window|<img src=x/);
  assert.match(main(html), /&lt;script&gt;window\.__xss=1&lt;\/script&gt;/);
  assert.equal(html.split("<script>").length - 1, 1);
  assert.doesNotMatch(html, new RegExp(`<title>[^<]*<script`));
});

test("aviz necompletat: formularele statice există în public/unelte/formulare", () => {
  for (const name of ["a4.pdf", "a5.pdf", "preview.png"]) {
    const buf = readFileSync(new URL(`../public/unelte/formulare/aviz-de-insotire-a-marfii-14-3-6a-${name}`, import.meta.url));
    assert.ok(buf.length > 1000 && buf.length < 200_000, `${name}: ${buf.length} B`);
    if (name.endsWith(".pdf")) {
      assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
      assert.equal((buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length, 1, `${name}: o singură pagină`);
    }
  }
});

const CHROME = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((p) => p && existsSync(p));

test("aviz completat: Chrome tipărește un PDF A4 de o pagină", { skip: CHROME ? false : "fără Chrome" }, async () => {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage();
    await page.setContent(avizHtml(SAMPLE), { waitUntil: "load" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length, 1);
    assert.match(pdf.toString("latin1"), /\/MediaBox\s*\[\s*0 0 59[45]\.\d+ 841\.\d+\s*\]/);
  } finally {
    await browser.close();
  }
});

// ---------- built page (run `npm run build` first) ----------

const dist = (p: string) => readFileSync(join(process.cwd(), "dist", p, "index.html"), "utf8");
const PAGE = "unelte/generator-aviz-de-insotire";

test("pagina aviz: title, H1, canonical, JSON-LD valid (WebApplication, FAQPage, BreadcrumbList)", () => {
  const html = dist(PAGE);
  assert.match(html, /<title>Aviz de însoțire a mărfii — model PDF completat online \| Tapselo<\/title>/);
  assert.match(html, /<h1[^>]*>Generator aviz de însoțire a mărfii<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/generator-aviz-de-insotire\/">/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const byType = (t: string) => blocks.find((b) => b["@type"] === t);
  const app = byType("WebApplication");
  assert.ok(app);
  assert.equal(app.url, "https://tapselo.com/unelte/generator-aviz-de-insotire/");
  const faq = byType("FAQPage");
  assert.ok(faq);
  assert.ok(faq.mainEntity.length >= 6);
  for (const q of faq.mainEntity) assert.ok(html.includes(`>${q.name}</h3>`), `întrebarea nu e vizibilă: ${q.name}`);
  const crumbs = byType("BreadcrumbList");
  assert.deepEqual(
    crumbs.itemListElement.map((c: { name: string }) => c.name),
    ["Acasă", "Unelte gratuite", "Generator aviz de însoțire a mărfii"],
  );
});

test("pagina aviz: surse primare, formular gol, linkuri interne, copy curat", () => {
  const html = dist(PAGE);
  for (const id of ["267710", "267711", "267712", "267713", "171282"]) {
    assert.match(html, new RegExp(`href="https://legislatie\\.just\\.ro/Public/DetaliiDocument/${id}"`));
  }
  assert.match(html, /id="surse"/);
  assert.match(html, /href="\/unelte\/formulare\/aviz-de-insotire-a-marfii-14-3-6a-a4\.pdf"/);
  assert.match(html, /href="\/unelte\/formulare\/aviz-de-insotire-a-marfii-14-3-6a-a5\.pdf"/);
  for (const href of ["/unelte/generator-nir/", "/unelte/fisa-de-magazie/"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
  assert.doesNotMatch(html, CEDILLA);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, FORBIDDEN);
  assert.doesNotMatch(text, /Tapselo (e|este) gratuit(?! cât timp e în beta)/);
});

test("aviz: legat din /unelte/, NIR și fișa de magazie", () => {
  for (const p of ["unelte", "unelte/generator-nir", "unelte/fisa-de-magazie"]) {
    assert.ok(dist(p).includes('href="/unelte/generator-aviz-de-insotire/"'), p);
  }
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/tapselo\.com\/unelte\/generator-aviz-de-insotire\/<\/loc>/);
});
