// Run after `npm run build` (ALLOW_TODO_PLACEHOLDERS=1 while the draft still has TODO slots).
// /comparatie/cel-mai-bun-program-casa-de-marcat/: schema, FAQ parity and copy rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { findTodoPlaceholders } from "../src/lib/build/todo-guard.ts";

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

test("todo guard flags placeholders and passes clean HTML", async () => {
  const dir = await mkdtemp(join(tmpdir(), "todo-guard-"));
  await mkdir(join(dir, "a"));
  await writeFile(join(dir, "a/index.html"), '<div data-todo="TODO-FOTO">[TODO-FOTO: x]</div> {DATA_PUBLICARE}');
  await writeFile(join(dir, "index.html"), "<p>Gata de publicare.</p>");
  const hits = await findTodoPlaceholders(dir);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].page, join("a", "index.html"));
  assert.ok(hits[0].matches.includes("{DATA_PUBLICARE"));
});
