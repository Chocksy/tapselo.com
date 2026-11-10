// Run after `npm run build`
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "dist/ghid/declarare-punct-de-lucru-anaf/index.html");
const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
const text = (html: string) =>
  decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
  .trim();

test("title, H1, lead și decizie 060/061", () => {
  const html = readFileSync(file, "utf8");
  assert.match(
    decode(/<title>([^<]*)<\/title>/.exec(html)![1]),
    /Declarare punct de lucru la ANAF 2026/,
  );
  assert.match(text(html), /Cum declari un punct de lucru \(sediu secundar\) la ANAF în 2026/);
  assert.match(text(html), /060, secțiunea A/);
  assert.match(text(html), /061/);
  assert.match(text(html), /cel puțin o persoană/);
  assert.match(text(html), /D700/);
  assert.doesNotMatch(text(html), /\bpână la 30 iunie 2026\b.*\btermen curent/i);
  assert.match(text(html), /minimum 5 angajați|5 salariați/);
  assert.doesNotMatch(text(html), /minimum 5 angajați este obligatoriu/i);
  assert.doesNotMatch(text(html), /inventează/i);
  assert.doesNotMatch(text(html), /Meniune/i);
  assert.match(text(html), /Mențiune/);
  assert.match(text(html), /D_060_OPANAF_508_2026\.pdf/);
  assert.match(text(html), /060_A8_OPANAF_3725_2017\.pdf/);
  assert.match(text(html), /declarația de radiere/);
});

test("JSON-LD Article + FAQPage", () => {
  const html = readFileSync(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
  assert.ok(blocks.some((b) => b["@type"] === "Article"));
  assert.ok(blocks.some((b) => b["@type"] === "FAQPage"));
  assert.ok(blocks.some((b) => b["@type"] === "BreadcrumbList"));
});

test("sitemap și hub", () => {
  const hub = readFileSync(join(process.cwd(), "dist/ghid/index.html"), "utf8");
  assert.match(hub, /href="\/ghid\/declarare-punct-de-lucru-anaf\/"/);
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/tapselo\.com\/ghid\/declarare-punct-de-lucru-anaf\/<\/loc>\s*<lastmod>2026-11-10/,
  );
});
