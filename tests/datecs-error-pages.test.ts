// TAP-018: Datecs per-error pages. Quotes must exist verbatim in the extracted manufacturer text
// (docs/sources/datecs/<doc>.txt, on the cited page); copy rules and schema checked on dist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const data = JSON.parse(readFileSync("src/lib/kb/datecs-error-pages.json", "utf8"));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function pageText(doc: string, page: number): string {
  const raw = readFileSync(`docs/sources/datecs/${doc}.txt`, "utf8");
  assert.ok(raw.includes(data.sources[doc].url), `${doc}.txt must name its source URL`);
  const parts = raw.split(/^=== pag\. (\d+) ===$/m);
  for (let i = 1; i < parts.length; i += 2) if (Number(parts[i]) === page) return norm(parts[i + 1]);
  assert.fail(`${doc} pag. ${page} missing from fixture`);
}

function quotes(): { text: string; doc: string; page: number; where: string }[] {
  const out: { text: string; doc: string; page: number; where: string }[] = [];
  const add = (q: any, where: string) => out.push({ text: q.text, doc: q.doc, page: q.page, where });
  data.service.forEach((q: any) => add(q, "service"));
  add(data.codeList, "codeList");
  for (const p of data.pages) {
    add({ text: p.m1.en, doc: "M1", page: p.m1.page }, `${p.slug} m1.en`);
    add({ text: p.m1.ro, doc: "M1", page: p.m1.page }, `${p.slug} m1.ro`);
    for (const d of p.display) (add(d.message, `${p.slug} display`), add(d.remedy, `${p.slug} remedy`));
    for (const g of p.stepGroups) (g.steps.forEach((s: any) => add(s, `${p.slug} step`)), g.after && add(g.after, `${p.slug} after`));
    (p.extraQuotes ?? []).forEach((q: any) => add(q, `${p.slug} extra`));
  }
  return out;
}

test("every quoted string is found verbatim on the cited source page", () => {
  const qs = quotes();
  assert.ok(qs.length > 30);
  for (const q of qs) assert.ok(pageText(q.doc, q.page).includes(norm(q.text)), `${q.where}: not in ${q.doc} pag. ${q.page}: ${q.text}`);
});

const built = data.pages.map((p: any) => ({ p, file: `dist/ghid/erori-datecs/${p.slug}/index.html` }));
const visible = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
const main = (html: string) => (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html);

test("pages are built", () => {
  for (const { file } of built) assert.ok(existsSync(file), `${file} missing (run astro build)`);
});

test("copy rules: no banned words, no cedilla, no Tapselo-shows-error claim, ≥350 words", () => {
  for (const { p, file } of built) {
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    const own = JSON.stringify({ ...p, display: undefined, stepGroups: undefined, extraQuotes: undefined, m1: undefined });
    assert.doesNotMatch(html, /[şţŞŢ]/, `${p.slug}: cedilla`);
    for (const w of [/certificat Datecs/i, /\bavizat/i, /omologat/i, /fără driver/i, /fără tehnician/i]) {
      assert.doesNotMatch(visible(html), w, `${p.slug}: banned ${w}`);
    }
    assert.doesNotMatch(visible(html), /Tapselo (afișează|arată|vă arată|semnalează)/i, `${p.slug}: unconfirmed product claim`);
    assert.doesNotMatch(own, /\b(faci|ai|poți|tău|ta|vezi|sună|verifică-ți)\b/i, `${p.slug}: tu-form in own copy`);
    const words = norm(visible(main(html))).split(" ").filter((w) => /\p{L}/u.test(w)).length;
    assert.ok(words >= 350, `${p.slug}: only ${words} words`);
  }
});

test("JSON-LD: TechArticle, FAQPage, BreadcrumbList, HowTo; no SoftwareApplication", () => {
  for (const { p, file } of built) {
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
      const j = JSON.parse(m[1]);
      return Array.isArray(j) ? j : j["@graph"] ?? [j];
    });
    const types = blocks.map((b: any) => b["@type"]);
    for (const t of ["TechArticle", "FAQPage", "BreadcrumbList", "HowTo"]) assert.ok(types.includes(t), `${p.slug}: ${t} missing (${types})`);
    assert.ok(!types.includes("SoftwareApplication"), `${p.slug}: SoftwareApplication present`);
    const art = blocks.find((b: any) => b["@type"] === "TechArticle");
    assert.equal(art.headline, p.h1);
    assert.ok(art.citation.includes(data.sources.M1.url));
    const faq = blocks.find((b: any) => b["@type"] === "FAQPage");
    assert.equal(faq.mainEntity.length, p.faq.length);
    assert.ok(p.faq.length >= 3 && p.faq.length <= 4);
    assert.ok(html.includes("nu suntem service autorizat Datecs"));
  }
});

test("hub links every page as Ghid complet", () => {
  const f = "dist/ghid/erori-datecs/index.html";
  if (!existsSync(f)) return;
  const html = readFileSync(f, "utf8");
  for (const p of data.pages) assert.ok(html.includes(`href="/ghid/erori-datecs/${p.slug}/"`), `hub: no link to ${p.slug}`);
});
