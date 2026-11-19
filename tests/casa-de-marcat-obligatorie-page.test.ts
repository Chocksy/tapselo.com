// Run after `npm run build`. /ghid/casa-de-marcat-obligatorie/: AMEF, târg, card FAQ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_LEGAL_QUOTES } from "../src/lib/kb/casa-de-marcat-obligatorie-quotes.ts";

const file = join(process.cwd(), "dist/ghid/casa-de-marcat-obligatorie/index.html");
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
  decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function page() {
  const html = readFileSync(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  return { html, blocks, main };
}

test("title, H1, lead și H2 târg", async () => {
  const { html, main } = await page();
  assert.match(decode(/<title>([^<]*)<\/title>/.exec(html)![1]), /Casă de marcat obligatorie 2026/);
  assert.match(
    text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]),
    /Casă de marcat obligatorie în 2026: cine trebuie să aibă și ce e valabil la târguri/,
  );
  const t = text(main);
  assert.match(t, /art\. 1 alin\. \(1\)/i);
  assert.match(t, /cardurilor de credit\/debit/i);
  assert.match(t, /Casă de marcat la târgul de Crăciun/);
  assert.match(t, /01\.01\.2026/);
});

test("Article, FAQPage, BreadcrumbList — fără AggregateRating", async () => {
  const { blocks } = await page();
  const types = blocks.map((b) => b["@type"]);
  assert.ok(types.includes("Article"));
  assert.ok(types.includes("FAQPage"));
  assert.ok(types.includes("BreadcrumbList"));
  assert.ok(!types.some((t) => t === "AggregateRating"));
  const article = blocks.find((b) => b["@type"] === "Article");
  assert.equal(article.datePublished, "2026-11-13");
  assert.equal(article.dateModified, "2026-11-13");
});

test("FAQ vizibil = FAQPage; card-only nu scutește AMEF", async () => {
  const { blocks, main } = await page();
  const t = text(main);
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  for (const q of faq) {
    assert.ok(t.includes(q.name), `FAQ q: ${q.name}`);
    assert.ok(t.includes(q.acceptedAnswer.text), `FAQ a: ${q.name}`);
  }
  const cardFaq = faq.find((q: { name: string }) => q.name.includes("doar cu cardul"));
  assert.ok(cardFaq, "missing card FAQ");
  assert.match(cardFaq.acceptedAnswer.text, /^Da,/);
  assert.match(cardFaq.acceptedAnswer.text, /art\. 1 alin\. \(1\)/);
  assert.doesNotMatch(cardFaq.acceptedAnswer.text, /\bnu[, ]+atunci când|\bnu este necesar\b|\bnu mai trebuie casă/i);
});

test("surse legislatie.just.ro și verificat", async () => {
  const { html } = await page();
  assert.match(html, /DetaliiDocument\/17431/);
  assert.match(html, /DetaliiDocument\/266909/);
  assert.match(html, /DetaliiDocument\/304522/);
  assert.match(html, /DetaliiDocument\/305208/);
  assert.match(html, /Verificat la 13\.11\.2026/);
  assert.ok(!/ghidullegal/i.test(html));
});

test("AJFP stand fix, fără procedură inventată", async () => {
  const { main } = await page();
  const t = text(main);
  assert.match(t, /AJFP/i);
  assert.match(t, /stand fix/i);
  assert.doesNotMatch(t, /art\. 103 alin/i);
  assert.match(t, /produse agricole din producție proprie/i);
  assert.match(t, /permanent sau sezonier/i);
  assert.doesNotMatch(t, /raportul Z și transmiterea conform OUG 28/i);
});

const normQuote = (s: string) =>
  s
    .replace(/[„"""]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function blockquoteBodies(html: string): string[] {
  return [...html.matchAll(/<blockquote class="kb-blockquote">([\s\S]*?)<\/blockquote>/g)].map((m) =>
    normQuote(text(m[1])),
  );
}

test("citate legale verbatim în blockquote, fără caracter „>” vizibil", async () => {
  const { html, main } = await page();
  assert.ok(html.includes('class="kb-blockquote"'));
  const bqs = blockquoteBodies(html);
  assert.equal(bqs.length, 5);
  const joined = bqs.join(" ");
  for (const q of Object.values(VERIFIED_LEGAL_QUOTES)) {
    assert.ok(joined.includes(normQuote(q)), `missing quote: ${q.slice(0, 60)}`);
  }
  assert.ok(bqs.some((b) => b.includes("(1) Operatorii economici")));
  assert.ok(bqs.some((b) => b.includes("activități:") && b.includes("a) comerțul ocazional")));
  const visibleMain = text(main);
  assert.doesNotMatch(visibleMain, /(^|\s)>\s/);
  assert.doesNotMatch(visibleMain, /activități:\s*>\s*a\)/);
});

test("FAQ mai multe târguri: fără regim Norme inventat", async () => {
  const { main } = await page();
  const t = text(main);
  const faqA =
    /Pot folosi aceeași casă[^?]*\?[\s\S]*?(?=Pot folosi|Din 2026|$)/.exec(t)?.[0] ??
    t.slice(t.indexOf("Pot folosi aceeași casă"));
  assert.match(faqA, /nu este descrisă o procedură/i);
  assert.match(faqA, /AJFP/i);
  assert.doesNotMatch(faqA, /fiscalizat AMEF|procedura detaliată din Norme|regim ambulant/i);
});

test("ș/ț, layout ghid", async () => {
  const { html } = await page();
  assert.ok(!/[şţŞŢ]/.test(html));
  assert.match(html, /guide-layout/);
});

test("checklist: formulare art. 4 fără englezisme", async () => {
  const { main } = await page();
  const t = text(main);
  assert.match(t, /nu este o excepție în art\. 4/);
  assert.match(t, /Excluderea vânzărilor ocazionale din acel articol/);
  assert.match(t, /nu înlocuiește obligația de AMEF/);
  assert.doesNotMatch(t, /Carve-out|carve-out/i);
  assert.doesNotMatch(t, /absența AMEF-ului/);
});

test("sitemap lastmod și hub", () => {
  const hub = readFileSync(join(process.cwd(), "dist/ghid/index.html"), "utf8");
  assert.match(hub, /href="\/ghid\/casa-de-marcat-obligatorie\/"/);
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/tapselo\.com\/ghid\/casa-de-marcat-obligatorie\/<\/loc>\s*<lastmod>2026-11-13/,
  );
});

test("link intern din program calculator", () => {
  const calc = readFileSync(join(process.cwd(), "dist/program-casa-de-marcat-pe-calculator/index.html"), "utf8");
  assert.match(calc, /href="\/ghid\/casa-de-marcat-obligatorie\/"/);
});

test("link intern din deschide minimarket", () => {
  const open = readFileSync(join(process.cwd(), "dist/ghid/deschide-minimarket-alimentara/index.html"), "utf8");
  assert.match(open, /href="\/ghid\/casa-de-marcat-obligatorie\/"/);
});
