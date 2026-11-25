// Run after `npm run build` — fișă de magazie title/H1/lead/FAQ (TAP-FISA-MODEL).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const dist = (p: string) => readFileSync(join(process.cwd(), "dist", p, "index.html"), "utf8");
const PAGE = "unelte/fisa-de-magazie";

const NORMS_VERBATIM = [
  "Fișa de magazie servește ca document de evidență a intrărilor, ieșirilor și stocurilor de bunuri materiale.",
  "Fișele de magazie se țin pe fiecare loc de depozitare a valorilor materiale, pe feluri de materiale, ordonate pe conturi, grupe, eventual subgrupe, sau în ordine alfabetică.",
  "Pentru valori materiale primite spre prelucrare de la terți sau în custodie se întocmesc fișe distincte, care se țin separat de cele aferente propriilor valori materiale.",
  "Înregistrările în fișele de magazie se fac document cu document.",
];

const FAQ_EXPECTED = [
  "Ce este fișa de magazie (cod 14-3-8)?",
  "Unde găsesc un model de fișă de magazie?",
  "Trebuie să o țin pe fiecare magazie / produs?",
  "Pot descărca un model gol în PDF?",
  "Pot folosi generatorul fără cont Tapselo?",
  "Cum leg fișa de magazie de NIR?",
  "Stocul se calculează singur?",
];

test("fișă de magazie: title, H1, meta, lead și model gol în hero", () => {
  const html = dist(PAGE);
  assert.match(html, /<title>Fișă de magazie \(cod 14-3-8\) — model PDF \| Tapselo<\/title>/);
  assert.match(html, /<h1[^>]*>Fișă de magazie \(cod 14-3-8\): model PDF<\/h1>/);
  assert.match(
    html,
    /name="description" content="Model fișă de magazie gratuit, cod 14-3-8 OMFP 2\.634\/2015/,
  );
  assert.match(html, /de evidență a intrărilor, ieșirilor și stocurilor de bunuri materiale/);
  assert.match(html, /modelul gol în PDF/);
  assert.match(html, /id="fm-blank-hero"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/fisa-de-magazie\/">/);
  assert.doesNotMatch(html, /Modelul oficial are/i);
  assert.doesNotMatch(html, /nomenclator/i);
  for (const quote of NORMS_VERBATIM) {
    assert.ok(html.includes(quote), `lipsește citatul norme: ${quote.slice(0, 40)}…`);
  }
});

test("llms.txt: intrare fișă de magazie (cod 14-3-8)", () => {
  const txt = readFileSync(join(process.cwd(), "dist", "llms.txt"), "utf8");
  assert.match(
    txt,
    /- \[Fișă de magazie \(cod 14-3-8\)\]\(https:\/\/tapselo\.com\/unelte\/fisa-de-magazie\/\):/,
  );
});

test("fișă de magazie: FAQ vizibil și FAQPage JSON-LD aliniat", () => {
  const html = dist(PAGE);
  for (const q of FAQ_EXPECTED) {
    assert.ok(html.includes(q), `lipsește întrebarea: ${q}`);
  }
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  assert.ok(faq);
  const names = (faq.mainEntity as { name: string }[]).map((e) => e.name);
  assert.deepEqual(names, FAQ_EXPECTED);
  const answers = (faq.mainEntity as { acceptedAnswer: { text: string } }[]).map((e) => e.acceptedAnswer.text);
  assert.match(answers[3], /antet și rânduri goale/);
  assert.doesNotMatch(answers[2], /Adică o fișă/);
  for (const quote of NORMS_VERBATIM) {
    assert.ok(answers.some((a) => a.includes(quote)), `FAQ JSON-LD: lipsește ${quote.slice(0, 30)}…`);
  }
});

test("fișă de magazie: JSON-LD WebApplication cu H1 și cod", () => {
  const html = dist(PAGE);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  assert.equal(app?.name, "Fișă de magazie (cod 14-3-8): model PDF | Tapselo");
  assert.match(app?.description ?? "", /14-3-8/);
  assert.match(app?.description ?? "", /model fișă de magazie/i);
});

test("fișă de magazie: sitemap lastmod pinned", () => {
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/tapselo\.com\/unelte\/fisa-de-magazie\/<\/loc>\s*<lastmod>2026-11-13/,
  );
});
