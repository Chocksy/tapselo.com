// Run after `npm run build`.
// /comparatie/cel-mai-bun-program-casa-de-marcat/: schema, FAQ parity and copy rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/comparatie/cel-mai-bun-program-casa-de-marcat/index.html");

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
  const article = /<article[^>]*data-bestof[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? "";
  return { html, blocks, article };
}

test("JSON-LD parses: Article, FAQPage, BreadcrumbList, ItemList; no ratings, offers or SoftwareApplication", async () => {
  const { blocks, html } = await page();
  const types = blocks.map((b) => b["@type"]).sort();
  assert.deepEqual(types, ["Article", "BreadcrumbList", "FAQPage", "ItemList"]);
  assert.doesNotMatch(html, /AggregateRating|"Review"|ratingValue|"Offer"|SoftwareApplication/);
  const list = blocks.find((b) => b["@type"] === "ItemList");
  assert.equal(list.numberOfItems, 7);
  for (const item of list.itemListElement) {
    const id = String(item.url).split("#")[1];
    assert.match(html, new RegExp(`id="${id}"`), `missing anchor #${id}`);
  }
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList").itemListElement.map((c: { name: string }) => c.name);
  assert.deepEqual(crumbs, ["Acasă", "Comparație", "Cel mai bun program de casă de marcat"]);
});

test("visible FAQ text equals FAQPage JSON-LD", async () => {
  const { blocks, article } = await page();
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  const visible = [...article.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.equal(visible.length, 7);
  assert.deepEqual(
    visible,
    faq.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]),
  );
});

test("copy rules: comma-below ș/ț only, no banned words", async () => {
  const { html } = await page();
  const t = text(html);
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla ş/ţ found");
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) {
    assert.ok(!t.toLowerCase().includes(w.toLowerCase()), `banned: ${w}`);
  }
});

test("Tapselo price only in the approved form", async () => {
  const { article } = await page();
  const t = text(article);
  const approved = "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA";
  for (const m of t.matchAll(/Tapselo/g)) {
    const window = t.slice(m.index!, m.index! + 60 + "Tapselo".length);
    const g = window.indexOf("gratuit");
    if (g === -1) continue;
    const at = m.index! + g;
    assert.equal(t.slice(at, at + approved.length), approved, `bad Tapselo price near: ${t.slice(m.index!, at + 80)}`);
  }
  assert.ok(t.split(approved).length - 1 >= 5, "approved price string missing");
  assert.ok(!/(?<!79\/)129 lei\/lună|\b79 lei\/lună/.test(t), "Tapselo price outside the approved string");
});

test("no placeholders, author and dates filled, competitor prices sourced", async () => {
  const { html, blocks, article } = await page();
  assert.doesNotMatch(html, /data-todo|TODO|\{DATA_|\[TODO/);
  const a = blocks.find((b) => b["@type"] === "Article");
  assert.equal(a.datePublished, "2026-10-20");
  assert.equal(a.dateModified, "2026-10-26");
  assert.equal(a.author.name, "Razvan Ciocanel");
  assert.equal(a.author.jobTitle, "Fondator Tapselo");
  assert.deepEqual(a.author.sameAs, ["https://www.linkedin.com/in/chocksy/"]);
  const t = text(article);
  assert.ok(text(html).replace(/ ,/g, ",").includes("De Razvan Ciocanel, Fondator Tapselo"), "byline");
  assert.equal(a.author.image, "https://tapselo.com/authors/razvan-ciocanel@2x.webp");
  assert.match(html, /src="\/authors\/razvan-ciocanel\.webp"/);
  for (const u of ["https://www.smartbill.ro/preturi/vanzare-cu-casa-marcat", "https://www.oblio.eu/cat-costa", "https://noxta.ro/pricing"]) {
    assert.ok(article.includes(`href="${u}"`), `missing price source ${u}`);
  }
  assert.ok(t.includes("accesat la 20.10.2026"));
});

test("links to program casă de marcat pe calculator guide", async () => {
  const { article } = await page();
  assert.ok(article.includes('href="/program-casa-de-marcat-pe-calculator/"'), "inline link to calculator guide");
  assert.ok(
    article.includes('href="https://tapselo.com/program-casa-de-marcat-pe-calculator/"'),
    "Surse link to calculator guide",
  );
});

test("title, no GuideShell CTA box, page OG image", async () => {
  const { html } = await page();
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  assert.equal(decode(title), "Cel mai bun program de casă de marcat în 2026 | Tapselo");
  assert.equal(decode(title).length, 55);
  assert.ok(!html.includes('data-tapselo-cta="ghid-bestof-program-casa-de-marcat"'), "GuideShell CTA should be off");
  assert.ok(!text(html).includes("Vezi cum funcționează"), "GuideShell CTA button text found");
  const og = "https://tapselo.com/og/cel-mai-bun-program-casa-de-marcat.png";
  assert.ok(html.includes(`<meta property="og:image" content="${og}"`), "og:image");
  assert.ok(html.includes(`<meta name="twitter:image" content="${og}"`), "twitter:image");
});

test("other GuideShell pages keep the built-in CTA", async () => {
  const other = await readFile(join(process.cwd(), "dist/program-gestiune-magazin/index.html"), "utf8");
  assert.ok(other.includes('data-tapselo-cta="ghid-program-gestiune-magazin"'));
});

test("article DOM: every section and CTA is a direct child (no stray <small> wrapper)", async () => {
  const { parse } = await import("node-html-parser");
  const { html } = await page();
  const article = parse(html).querySelector("article[data-bestof]");
  assert.ok(article);
  assert.equal(html.includes("<small"), false, "use span.bestof-note; Astro misnests <small> in this table");
  const kids = article.childNodes.filter((n) => n.nodeType === 1).map((n) => (n as unknown as { rawTagName: string }).rawTagName.toLowerCase());
  assert.ok(kids.every((t) => ["section", "aside", "div", "p"].includes(t)), kids.join(","));
  assert.equal(kids.filter((t) => t === "aside").length, 2);
  const h2s = article.querySelectorAll("h2.kb-h2");
  assert.ok(h2s.length >= 8);
  for (const h of h2s) assert.equal(h.parentNode.parentNode, article, `${h.text} is not inside a direct child section`);
});
