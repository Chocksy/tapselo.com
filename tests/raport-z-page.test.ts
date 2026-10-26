// Run after `npm run build`. /ghid/articole/raport-z-datecs-fp-70/: headings, byline, JSON-LD parity, copy rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/ghid/articole/raport-z-datecs-fp-70/index.html");
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

test("title, H1 and meta description unchanged", async () => {
  const { html } = await page();
  assert.equal(decode(/<title>([^<]*)<\/title>/.exec(html)![1]), "Cum scoți raportul Z pe Datecs FP-70 | Ghid Tapselo");
  assert.equal(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]), "Cum scoți raportul Z pe Datecs FP-70");
  assert.match(decode(html), /<meta name="description" content="Închiderea zilei fiscale pe imprimanta Datecs FP-70 \/ seria FP: raport Z din mod autonom sau din DUDE, fără bon deschis, și ce faci dacă apare eroare\."/);
});

test("no H3 before the first H2", async () => {
  const { html } = await page();
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  const firstH2 = levels.indexOf(2);
  assert.ok(firstH2 > 0);
  assert.ok(!levels.slice(0, firstH2).includes(3), `heading order: ${levels.join(",")}`);
  assert.match(html, /<h2[^>]*>Ce apare pe afișaj \(text\)<\/h2>/);
});

test("byline and Article author Person", async () => {
  const { html, blocks } = await page();
  assert.ok(text(html).includes("De Razvan Ciocanel, Fondator Tapselo"));
  assert.match(html, /src="\/authors\/razvan-ciocanel\.webp"/);
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/chocksy\/"/);
  const a = blocks.find((b) => b["@type"] === "Article");
  assert.equal(a.author["@type"], "Person");
  assert.equal(a.author.name, "Razvan Ciocanel");
  assert.equal(a.author.jobTitle, "Fondator Tapselo");
  assert.deepEqual(a.author.sameAs, ["https://www.linkedin.com/in/chocksy/"]);
});

test("FAQPage and HowTo JSON-LD match the visible text", async () => {
  const { blocks, main } = await page();
  const t = text(main);
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  for (const q of faq) {
    assert.ok(t.includes(q.name), `FAQ q not visible: ${q.name}`);
    assert.ok(t.includes(q.acceptedAnswer.text), `FAQ a not visible: ${q.acceptedAnswer.text}`);
  }
  const howto = blocks.find((b) => b["@type"] === "HowTo").step;
  for (const s of howto) assert.ok(t.includes(`${s.name}. ${s.text}`), `step not visible: ${s.name}`);
});

test("dumneavoastră, ș/ț only, no banned words, platform line kept", async () => {
  const { html, main } = await page();
  const t = text(html);
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla");
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) {
    assert.ok(!t.toLowerCase().includes(w.toLowerCase()), `banned: ${w}`);
  }
  // Unicode-aware word boundaries: \b is blind to Romanian diacritics (e.g. apăsa / închizi).
  const informalTu =
    /(?<![\p{L}])(apeși|apasă|scoți|schimbi|faci|continui|vinzi|poți|închizi|anulezi|anunți|vezi|reiei)(?![\p{L}])/iu;
  // Article-owned copy: body through FAQ; stops before related cards / sources / shared CTA.
  const start = main.indexOf('<article class="kb-prose"');
  const end = main.indexOf(">Articole legate<");
  assert.ok(start >= 0 && end > start, "expected article body and related-articles marker");
  const owned = main.slice(start, end);
  assert.ok(owned.length > 200, "expected article-owned markup");
  assert.ok(owned.includes("Închideți orice bon deschis"), "owned slice must include steps");
  assert.doesNotMatch(text(owned), informalTu);
  assert.ok(!t.includes("reiei"), "leftover tu-form reiei");
  assert.ok(t.includes("reluați"), "paper error row should use reluați");
  assert.ok(t.includes("Închideți orice bon deschis"), "step 1 heading dumneavoastră");
  assert.ok(t.includes("rulează pe Windows, macOS sau Linux (telefonul e pentru inventar)"));
  for (const m of decode(html).matchAll(/79\/129[^"<]*/g)) assert.equal(m[0], "79/129 lei/lună + TVA");
});
