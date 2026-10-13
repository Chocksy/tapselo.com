import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { homepageFaq, homepageFaqJsonLd } from "../src/lib/homepage-faq.ts";

const FORBIDDEN = /\b(certificat Datecs|avizat|omologat|fără driver|fără tehnician)\b/i;

test("homepage FAQ includes offline question grounded in product copy", () => {
  const offline = homepageFaq.find((item) => item.q === "Tapselo funcționează fără internet?");
  assert.ok(offline);
  assert.match(offline.a, /Windows, macOS sau Linux/);
  assert.match(offline.a, /bonul fiscal/i);
  assert.match(offline.a, /sincronizează/i);
  assert.match(offline.a, /inventar/i);
  assert.doesNotMatch(offline.a, FORBIDDEN);
  for (const item of homepageFaq) {
    assert.doesNotMatch(item.a, FORBIDDEN);
  }
});

test("homepage FAQ JSON-LD is FAQPage without markdown in answers", () => {
  const block = homepageFaqJsonLd();
  assert.equal(block["@type"], "FAQPage");
  const entities = block.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  assert.ok(entities.some((e) => e.name === "Tapselo funcționează fără internet?"));
  for (const e of entities) {
    assert.doesNotMatch(e.acceptedAnswer.text, /\*\*/);
  }
});

test("built homepage includes FAQ section and FAQPage JSON-LD", () => {
  const html = readFileSync(join(process.cwd(), "dist/index.html"), "utf8");
  assert.match(html, /Tapselo funcționează fără internet\?/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /casa-de-marcat-fara-internet/);
  assert.match(html, /id="faq"/);
});
