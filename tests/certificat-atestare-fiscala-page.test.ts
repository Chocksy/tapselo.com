// Run after `npm run build`. /ghid/certificat-de-atestare-fiscala/: legal copy, JSON-LD, hub links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/ghid/certificat-de-atestare-fiscala/index.html");
const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const text = (html: string) =>
  decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/ ([.,:;?!])/g, "$1")
    .trim();

async function page() {
  const html = await readFile(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  return { html, blocks, main };
}

test("title, H1 and meta description match brief", async () => {
  const { html } = await page();
  assert.equal(
    decode(/<title>([^<]*)<\/title>/.exec(html)![1]),
    "Certificat de atestare fiscală online din SPV (PF și PJ) — pași, termen, valabilitate | Tapselo",
  );
  assert.equal(
    text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]),
    "Certificat de atestare fiscală online: cum îl ceri din SPV",
  );
  assert.match(decode(html), /name="description" content="[^"]*SPV[^"]*3 zile lucrătoare/);
});

test("Article, FAQPage, HowTo and BreadcrumbList JSON-LD", async () => {
  const { blocks } = await page();
  const types = blocks.map((b) => b["@type"]);
  assert.ok(types.includes("Article"));
  assert.ok(types.includes("FAQPage"));
  assert.ok(types.includes("HowTo"));
  assert.ok(types.includes("BreadcrumbList"));
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
  assert.equal(crumbs.itemListElement.at(-1).name, "Certificat de atestare fiscală online: cum îl ceri din SPV");
});

test("FAQPage and HowTo JSON-LD match visible text", async () => {
  const { blocks, main } = await page();
  const t = text(main);
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  for (const q of faq) {
    assert.ok(t.includes(q.name), `FAQ q not visible: ${q.name}`);
    assert.ok(t.includes(q.acceptedAnswer.text), `FAQ a not visible: ${q.acceptedAnswer.text.slice(0, 40)}`);
  }
  const howto = blocks.find((b) => b["@type"] === "HowTo").step;
  const norm = (s: string) =>
    s
      .replace(/[„"""]/g, '"')
      .replace(/\s+/g, " ")
      .toLowerCase();
  for (const s of howto) {
    assert.ok(t.includes(s.name), `HowTo step name: ${s.name}`);
    assert.ok(norm(t).includes(norm(s.text).slice(0, 40)), `HowTo step text: ${s.name}`);
  }
});

test("legal anchors: art. 158 vs 159, SPV, no instant issue promise", async () => {
  const { main } = await page();
  const t = text(main);
  assert.match(t, /art\. 158/i);
  assert.match(t, /art\. 159/i);
  assert.match(t, /Spațiul privat virtual|SPV/i);
  assert.match(t, /3 zile lucrătoare/i);
  assert.match(t, /30 de zile/i);
  assert.match(t, /90 de zile/i);
  assert.ok(!/\binstant\b|aceeași zi/i.test(t), "must not promise same-day issue");
});

test("sources list S1–S3 URLs and verified date", async () => {
  const { html } = await page();
  assert.match(html, /Cod_Procedura_Fiscala_2023\.htm/);
  assert.match(html, /DetaliiDocument\/219392/);
  assert.match(html, /DocumentePF\.pdf/);
  assert.match(html, /Verificat la 02\.11\.2026/);
});

test("copy rules: ș/ț, no banned POS words, guide layout TOC", async () => {
  const { html } = await page();
  const t = text(html);
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla");
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) {
    assert.ok(!t.toLowerCase().includes(w.toLowerCase()), w);
  }
  assert.match(html, /guide-layout/);
  assert.match(html, /site-container/);
});

test("ghid index links to this page", async () => {
  const hub = await readFile(join(process.cwd(), "dist/ghid/index.html"), "utf8");
  assert.match(hub, /href="\/ghid\/certificat-de-atestare-fiscala\/"/);
});
