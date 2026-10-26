// Run after `npm run build`.
// /comparatie/tapselo-vs-smartbill-pos/: schema, FAQ parity, copy rules, price canon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/comparatie/tapselo-vs-smartbill-pos/index.html");

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
    .trim();

async function page() {
  const html = await readFile(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const article = /<article[^>]*data-vs-comparatie[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? "";
  return { html, blocks, article };
}

test("JSON-LD: Article, FAQPage, BreadcrumbList; no ratings or AggregateRating", async () => {
  const { blocks, html } = await page();
  const types = blocks.map((b) => b["@type"]).sort();
  assert.deepEqual(types, ["Article", "BreadcrumbList", "FAQPage"]);
  assert.doesNotMatch(html, /AggregateRating|"Review"|ratingValue/);
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList").itemListElement.map((c: { name: string }) => c.name);
  assert.deepEqual(crumbs, ["Acasă", "Comparație", "Tapselo vs SmartBill POS"]);
});

test("H1 and byline", async () => {
  const { html } = await page();
  const h1 = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  assert.equal(
    h1,
    "Tapselo vs SmartBill POS: care se potrivește unui magazin mic în 2026",
  );
  const t = text(html).replace(/ ,/g, ",");
  assert.ok(t.includes("De Razvan Ciocanel, Fondator Tapselo"));
  assert.ok(t.includes("Fapte verificate la"));
  assert.ok(t.includes("Tapselo este produsul nostru"));
});

test("visible FAQ equals FAQPage JSON-LD", async () => {
  const { blocks, article } = await page();
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  const visible = [...article.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.equal(visible.length, 4);
  assert.deepEqual(
    visible,
    faq.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]),
  );
});

test("copy rules: comma-below ș/ț, banned words, dumneavoastră in article body", async () => {
  const { article } = await page();
  const t = text(article);
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla ş/ţ found");
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) {
    assert.ok(!t.toLowerCase().includes(w.toLowerCase()), `banned: ${w}`);
  }
  assert.match(t, /Alegeți SmartBill POS dacă/);
  assert.match(t, /Alegeți Tapselo dacă/);
  assert.ok(t.includes("Aveți un magazin"), "dumneavoastră form");
});

test("Tapselo price canon and SmartBill price with source", async () => {
  const { article, html } = await page();
  const t = text(article);
  const approved = "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA";
  assert.ok(t.includes(approved));
  assert.ok(t.includes("10,9 €/lună + TVA"));
  assert.ok(article.includes('href="https://www.smartbill.ro/preturi/vanzare-cu-casa-marcat"'));
  assert.ok(t.includes("accesat la 22.10.2026"));
  assert.ok(!/(?<!79\/)129 lei\/lună|\b79 lei\/lună/.test(t), "Tapselo price outside approved string");
  assert.doesNotMatch(html, /SoftwareApplication|"Offer"/);
});

test("required internal links", async () => {
  const { article } = await page();
  for (const path of [
    "/comparatie/cel-mai-bun-program-casa-de-marcat/",
    "/program-gestiune-magazin/",
    "/ghid/erori-datecs/",
    "/demo/",
  ]) {
    assert.ok(article.includes(path), `missing link ${path}`);
  }
});

test("verdict before decision table in DOM order", async () => {
  const { article } = await page();
  const verdict = article.indexOf("Verdict pe scurt");
  const table = article.indexOf("Tabel de decizie");
  assert.ok(verdict > 0 && table > verdict);
});

test("same-task section marked documentat", async () => {
  const { article } = await page();
  assert.match(text(article), /documentat/i);
  assert.ok(!/testat pe FP-700 de echipa/i.test(text(article)));
});

test("fiscal printers: Daisy/Tremol supported, not în curând", async () => {
  const { article } = await page();
  const t = text(article);
  assert.ok(!/în curând/i.test(t), "în curând should not appear for printers");
  assert.match(t, /driver în produs/i);
  assert.ok(!/aveți o casă de marcat Daisy/i.test(t));
});
