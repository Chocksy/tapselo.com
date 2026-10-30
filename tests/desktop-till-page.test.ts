// Run after `npm run build`.
// /program-casa-de-marcat-pe-calculator/ (TAP-025 + phone/tablet/PC addendum).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "dist/program-casa-de-marcat-pe-calculator/index.html");
const CDEP = "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?an=2026&nr=303";

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
const norm = (s: string) => text(s).replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

async function page() {
  const html = await readFile(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const article = /<article[^>]*data-desktop-till[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? "";
  return { html, blocks, article };
}

test("phone/tablet section: answer-first copy, table rows, cdep + legislatie links", async () => {
  const { article } = await page();
  const t = text(article);
  assert.ok(t.includes("Casă de marcat pe telefon, tabletă sau calculator: ce e legal în 2026"));
  assert.ok(
    t.includes(
      "În 2026, bonul fiscal legal se emite tot de casa de marcat fiscală (AMEF), conectată la ANAF. Telefonul, tableta sau calculatorul pot rula programul de vânzare, dar bonul fiscal îl tipărește casa de marcat.",
    ),
  );
  assert.ok(t.includes("AMEF-V") && t.includes("nu este în vigoare"));
  assert.ok(t.includes("ce afișează o aplicație pe telefon fără casă de marcat nu este bon fiscal"));
  for (const row of ["Calculator (Windows/macOS/Linux)", "Tabletă", "Telefon", "AMEF-V (casă de marcat virtuală)", "Doar inventar", "Nu în prezent"]) {
    assert.ok(t.includes(row), `missing table row/cell: ${row}`);
  }
  assert.ok(article.includes(CDEP));
  assert.ok(article.includes("legislatie.just.ro/Public/DetaliiDocument/17431"));
  const phoneStart = article.indexOf('id="telefon-tableta-calculator"');
  const phoneEnd = article.indexOf("<section", phoneStart + 1);
  const phoneSection = article.slice(phoneStart, phoneEnd > phoneStart ? phoneEnd : undefined);
  assert.doesNotMatch(text(phoneSection), /lei\/lună|79\/129|gratuit cât timp/i, "no pricing in phone/tablet section");
});

test("visible FAQ equals FAQPage JSON-LD (plain text)", async () => {
  const { blocks, article } = await page();
  const faq = blocks.find((b) => b["@type"] === "FAQPage").mainEntity;
  const visible = [...article.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*(?:<dd[^>]*>([\s\S]*?)<\/dd>)/g)].map((m) => [norm(m[1]), norm(m[2])]);
  assert.equal(visible.length, 6);
  assert.deepEqual(
    visible,
    faq.map((q: { name: string; acceptedAnswer: { text: string } }) => [norm(q.name), norm(q.acceptedAnswer.text)]),
  );
  const phoneFaq = faq.find((q: { name: string }) => q.name === "Pot folosi telefonul drept casă de marcat?");
  assert.ok(phoneFaq.acceptedAnswer.text.includes("PL-x 303/2026"));
});

test("copy rules: ș/ț, banned words, dumneavoastră, AMEF-V as proposal not law", async () => {
  const { article } = await page();
  const t = text(article);
  assert.ok(!/[şţŞŢ]/.test(t), "cedilla ş/ţ found");
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) {
    assert.ok(!t.toLowerCase().includes(w.toLowerCase()), `banned: ${w}`);
  }
  assert.ok(t.includes("dumneavoastră"), "dumneavoastră register expected");
  assert.doesNotMatch(t.replace(/legislatie\.just\.ro/gi, ""), /\b(poți|ai|tău|ta|tale|vrei)\b/i);
  assert.ok(!t.includes("AMEF-V is only a bill"));
  assert.ok(t.includes("propunere legislativă") || t.includes("Propunerea"));
});

test("Tapselo price only in approved form in article", async () => {
  const { article } = await page();
  const t = text(article);
  const approved = "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA";
  assert.ok(t.includes(approved));
  for (const m of t.matchAll(/Tapselo/g)) {
    const window = t.slice(m.index!, m.index! + 80 + "Tapselo".length);
    const g = window.indexOf("gratuit");
    if (g === -1) continue;
    const at = m.index! + g;
    assert.equal(t.slice(at, at + approved.length), approved, `bad Tapselo price near: ${t.slice(m.index!, at + 80)}`);
  }
});

test("JSON-LD: WebApplication, FAQPage, BreadcrumbList", async () => {
  const { blocks } = await page();
  const types = blocks.map((b) => b["@type"]).sort();
  assert.deepEqual(types, ["BreadcrumbList", "FAQPage", "WebApplication"]);
});

test("WebApplication JSON-LD: desktop OS and canon offer, not free price-0", async () => {
  const { blocks } = await page();
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  assert.equal(app.operatingSystem, "Windows, macOS, Linux");
  assert.equal(app.isAccessibleForFree, undefined);
  assert.equal(app.offers.price, undefined);
  assert.equal(app.offers.description, "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA");
});
