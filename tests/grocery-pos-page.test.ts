// Run after `npm run build`. /program-casa-de-marcat-magazin-alimentar/ (TAP-GROCERY-ANSWER B).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/program-casa-de-marcat-magazin-alimentar/index.html");
const PATH = "https://tapselo.com/program-casa-de-marcat-magazin-alimentar/";
const approved = "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA";
const META_DESCRIPTION =
  "POS pentru magazin alimentar: scanare, cântar Dibal, bon Datecs, stoc și NIR, pe PC și iPhone. Preț: gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA.";

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const text = (html: string) =>
  decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const norm = (s: string) => text(s).replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

async function page() {
  const html = await readFile(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const article = /<article[^>]*data-grocery-pos[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? "";
  return { html, blocks, article };
}

test("200, canonical, title and H1", async () => {
  const { html } = await page();
  assert.match(html, /<title>Program casă de marcat magazin alimentar \| Tapselo<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/program-casa-de-marcat-magazin-alimentar\/"/);
  assert.match(html, /<h1[^>]*>Program casă de marcat pentru magazin alimentar<\/h1>/);
  assert.doesNotMatch(html, /name="robots" content="noindex"/);
});

test("sitemap lists page with lastmod on this URL", async () => {
  const sitemap = await readFile(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(sitemap, new RegExp(`<loc>${PATH}</loc>\\s*<lastmod>2026-11-16`));
});

test("visible FAQ equals FAQPage JSON-LD", async () => {
  const { blocks, article } = await page();
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  const visible = [...article.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*(?:<dd[^>]*>([\s\S]*?)<\/dd>)/g)].map((m) => [
    norm(m[1]),
    norm(m[2]),
  ]);
  assert.equal(visible.length, 5);
  assert.deepEqual(
    visible,
    faq.map((q: { name: string; acceptedAnswer: { text: string } }) => [norm(q.name), norm(q.acceptedAnswer.text)]),
  );
});

test("JSON-LD: WebApplication with canon offer, FAQPage, BreadcrumbList", async () => {
  const { blocks } = await page();
  const types = blocks.map((b) => b["@type"]).sort();
  assert.deepEqual(types, ["BreadcrumbList", "FAQPage", "WebApplication"]);
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  assert.equal(app.offers["@type"], "AggregateOffer");
  assert.equal(app.offers.description, approved);
  assert.equal(app.offers.price, undefined);
  assert.equal(app.offers.offers[0].priceSpecification.unitCode, "MON");
  assert.equal(app.offers.offers[0].priceSpecification.valueAddedTaxIncluded, false);
});

test("visible breadcrumb matches BreadcrumbList names and urls", async () => {
  const { html, blocks } = await page();
  const trail = blocks.find((b) => b["@type"] === "BreadcrumbList").itemListElement;
  const nav = html.match(/<nav aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? "";
  const visibleAnchors = [...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({
    href: m[1],
    name: m[2].trim(),
  }));
  const current = nav.match(/<span class="bc-c"[^>]*>([^<]+)<\/span>/)?.[1]?.trim() ?? "";
  assert.equal(visibleAnchors.length, trail.length - 1);
  for (let i = 0; i < visibleAnchors.length; i++) {
    assert.equal(visibleAnchors[i].name, trail[i].name);
    const itemUrl = trail[i].item as string;
    assert.ok(visibleAnchors[i].href === "/" || itemUrl.endsWith(visibleAnchors[i].href));
  }
  assert.equal(current, trail.at(-1).name);
  assert.equal(trail.at(-1).item, PATH);
});

test("meta description is exact approved grocery copy", async () => {
  const { html } = await page();
  const esc = META_DESCRIPTION.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  assert.match(html, new RegExp(`<meta name="description" content="${esc.replace(/[+]/g, "\\+")}"`));
});

test("price canon in article", async () => {
  const { article } = await page();
  const t = text(article);
  assert.ok(t.includes(approved));
  for (const m of t.matchAll(/Tapselo/g)) {
    const window = t.slice(m.index!, m.index! + 80 + "Tapselo".length);
    const g = window.indexOf("gratuit");
    if (g === -1) continue;
    const at = m.index! + g;
    assert.equal(t.slice(at, at + approved.length), approved, `bad Tapselo price near: ${t.slice(m.index!, at + 80)}`);
  }
});

test("section links: ghid minimarket and comparatie", async () => {
  const { article } = await page();
  assert.match(article, /href="\/ghid\/deschide-minimarket-alimentara\/"/);
  assert.match(article, /href="\/comparatie\/cel-mai-bun-program-casa-de-marcat\/"/);
  assert.match(article, /href="\/program-gestiune-magazin\/"/);
});