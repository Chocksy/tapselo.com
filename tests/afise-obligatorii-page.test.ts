import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const htmlPath = join(process.cwd(), "dist/unelte/afise-obligatorii-magazin/index.html");

test("built page: title, H1, canonical, JSON-LD", async () => {
  const html = await readFile(htmlPath, "utf8");
  assert.match(
    html,
    /<title>Afișe obligatorii magazin – generator gratuit \(casă de marcat, ANPC, program\) \| Tapselo<\/title>/,
  );
  assert.match(html, /<h1[^>]*>Această unitate este dotată cu casă de marcat – afișe obligatorii pentru magazin<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/afise-obligatorii-magazin\/">/);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /Generator afișe obligatorii magazin Tapselo/);
});
