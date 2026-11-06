// Run after `npm run build`. /ghid/pret-redus-30-zile/: Omnibus copy, JSON-LD, hub links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { glob } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/ghid/pret-redus-30-zile/index.html");
const heading = "Reduceri: prețul anterior, 30 zile";
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

test("title, H1 and meta description", async () => {
  const { html } = await page();
  assert.equal(decode(/<title>([^<]*)<\/title>/.exec(html)![1]), `${heading} | Ghid Tapselo`);
  assert.equal(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]), heading);
  assert.match(
    decode(html),
    /<meta name="description" content="La orice anunț de reducere \(inclusiv de Black Friday\), afișați prețul anterior conform HG 947\/2000 art\. 4\^1:/,
  );
});

test("Article, FAQPage, BreadcrumbList JSON-LD; last breadcrumb is heading", async () => {
  const { blocks } = await page();
  const types = blocks.map((b) => b["@type"]);
  assert.ok(types.includes("Article"));
  assert.ok(types.includes("FAQPage"));
  assert.ok(types.includes("BreadcrumbList"));
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
  assert.equal(crumbs.itemListElement.at(-1).name, heading);
});

test("FAQPage JSON-LD answers visible in main (plain text)", async () => {
  const { blocks, main } = await page();
  const t = text(main);
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  for (const q of faq) {
    assert.ok(t.includes(q.name), `FAQ q not visible: ${q.name}`);
    assert.ok(t.includes(q.acceptedAnswer.text), `FAQ a not visible: ${q.acceptedAnswer.text.slice(0, 50)}`);
  }
});

test("single dist output and ghid hub links here", async () => {
  const dist = join(process.cwd(), "dist");
  const paths: string[] = [];
  for await (const p of glob("**/pret-redus-30-zile/index.html", { cwd: dist })) paths.push(p);
  assert.equal(paths.length, 1, paths.join(", "));
  const hub = await readFile(join(dist, "ghid/index.html"), "utf8");
  assert.match(hub, /href="\/ghid\/pret-redus-30-zile\/"/);
});

test("legal anchors and calculator href", async () => {
  const { html, main } = await page();
  const t = text(main);
  assert.match(t, /art\. 4\^1/);
  for (const a of ["alin. (2)", "alin. (3)", "alin. (4)", "alin. (5)"]) assert.ok(t.includes(a), a);
  assert.match(t, /art\. 12 alin\. \(2\)/);
  assert.match(t, /30 de zile/);
  assert.match(t, /10 zile/);
  assert.match(t, /25 lei/);
  assert.match(html, /href="\/unelte\/calculator-reducere\/"/);
});

test("source URLs and verified date", async () => {
  const { html } = await page();
  assert.match(html, /DetaliiDocument\/255257/);
  assert.match(html, /DetaliiDocument\/24730/);
  assert.match(html, /DetaliiDocument\/255732/);
  assert.match(html, /Verificat la 06\.11\.2026/);
});

test("Romanian copy: no ş/ţ cedillas", async () => {
  const { html } = await page();
  assert.ok(!/[şţŞŢ]/.test(text(html)), "cedilla ş/ţ");
});
