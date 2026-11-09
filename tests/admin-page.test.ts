// Run after `npm run build`. /admin/ product page (F1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/admin/index.html");
const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const text = (html: string) =>
  decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function page() {
  const html = await readFile(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const main = /<main\b[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  return { html, blocks, main };
}

test("title, h1, canonical", async () => {
  const { html } = await page();
  assert.match(html, /<title>Adminul Tapselo: produse, NIR, rețete și rapoarte într-un loc<\/title>/);
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1.length, 1);
  assert.equal(text(h1[0][1]), "Conduci tot magazinul dintr-un singur loc.");
  assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/admin\/"/);
});

test("key facts are on the page", async () => {
  const t = text((await page()).main);
  for (const s of ["Fără abonament", "iPhone XS sau mai nou", "SAGA", "NIR din poza facturii", "Gratuit cât ține beta", "Windows, macOS, Linux"]) {
    assert.ok(t.includes(s), `missing: ${s}`);
  }
  assert.ok(t.includes("/casa-de-marcat-pe-telefon/") || (await page()).main.includes('href="/casa-de-marcat-pe-telefon/"'));
});

test("copy rules: no 'în curând', no em dash, no cedilla", async () => {
  const { main } = await page();
  const t = text(main);
  assert.doesNotMatch(t, /în curând/i);
  assert.ok(!main.includes("—") && !main.includes("&mdash;"), "em dash found");
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla ş/ţ found");
});

test("JSON-LD: WebApplication, breadcrumb, FAQPage equals visible FAQ", async () => {
  const { blocks, main } = await page();
  const types = blocks.map((b) => b["@type"]);
  for (const t of ["WebApplication", "FAQPage", "BreadcrumbList"]) assert.ok(types.includes(t), `missing ${t}`);
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  const visible = [...main.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>\s*<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.equal(visible.length, 6);
  assert.deepEqual(visible, faq.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, text(q.acceptedAnswer.text)]));
});
