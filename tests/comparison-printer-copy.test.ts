// Run after `npm run build`.
// Locks fiscal-printer marketing copy: Daisy/Tremol supported, not „în curând”.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

const pages = [
  { path: "dist/index.html", label: "homepage" },
  { path: "dist/comparatie/tapselo-vs-smartbill-pos/index.html", label: "vs-smartbill" },
  { path: "dist/comparatie/cel-mai-bun-program-casa-de-marcat/index.html", label: "best-of" },
  { path: "dist/comparatie/index.html", label: "comparatie-index" },
];

test("no Daisy/Tremol „în curând” on comparison and homepage equipment copy", async () => {
  for (const { path, label } of pages) {
    const html = await readFile(join(process.cwd(), path), "utf8");
    const t = text(html);
    assert.ok(!/Daisy[^.]{0,120}în curând/i.test(t), `${label}: Daisy + în curând`);
    assert.ok(!/Tremol[^.]{0,120}în curând/i.test(t), `${label}: Tremol + în curând`);
  }
});

test("vs-SmartBill does not steer Daisy/Tremol owners to SmartBill as only FP-700 path", async () => {
  const html = await readFile(join(process.cwd(), "dist/comparatie/tapselo-vs-smartbill-pos/index.html"), "utf8");
  const article = /<article[^>]*data-vs-comparatie[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? "";
  const t = text(article);
  assert.ok(!/aveți o casă de marcat Daisy/i.test(t), "old Daisy SmartBill steer bullet");
  assert.match(t, /driver în produs/i);
  assert.match(t, /validați modelul/i);
});

test("Tapselo comparatie matrix mentions Daisy/Tremol support", async () => {
  const html = await readFile(join(process.cwd(), "dist/comparatie/index.html"), "utf8");
  const t = text(html);
  assert.match(t, /Daisy și Tremol/i);
  assert.match(t, /gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
});
