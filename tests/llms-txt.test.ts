// /llms.txt: llmstxt.org format, copy rules, and every link points at a built page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// The built file (src/lib/llms/llms-txt.ts imports JSON route data, which node --test cannot load directly;
// the build itself fails if a route has no entry).
const SITE = "https://tapselo.com";
const txt = readFileSync(join(process.cwd(), "dist", "llms.txt"), "utf8");
const links = [...txt.matchAll(/^- \[([^\]]+)\]\((\S+)\): (.+)$/gm)];

test("llmstxt.org format: H1, blockquote summary, ## sections with link lists", () => {
  const lines = txt.split("\n");
  assert.equal(lines[0], "# Tapselo");
  assert.match(lines[2], /^> Tapselo .*casa de marcat.*Windows, macOS și Linux.*telefoanele .*gestiunea stocului/);
  assert.deepEqual([...txt.matchAll(/^## (.+)$/gm)].map((m) => m[1]), ["Unelte gratuite", "Ghiduri", "Comparații", "Despre Tapselo"]);
  assert.equal(txt.match(/^# /gm)?.length, 1);
  for (const l of lines.filter((x) => x.startsWith("- "))) assert.match(l, /^- \[[^\]]+\]\(https:\/\/tapselo\.com\/\S*\): \S/, l);
  assert.ok(links.length >= 40);
  assert.equal(new Set(links.map((m) => m[2])).size, links.length, "no duplicate links");
});

test("copy rules: no banned words, no prices or lei, comma-below ș/ț only", () => {
  for (const w of ["certificat Datecs", "avizat", "omologat", "fără driver", "fără tehnician"]) assert.ok(!txt.toLowerCase().includes(w.toLowerCase()), w);
  assert.doesNotMatch(txt, /\blei\b|\bron\b|€|\beur\b|\d[\d.,]*\s*%|\bpreț(ul)?\s*:/i);
  assert.doesNotMatch(txt, /\d{2,}[.,]?\d*\s*(lei|ron|eur)/i);
  assert.doesNotMatch(txt, /[şţŞŢ]/);
  assert.doesNotMatch(txt.replace(/\(https:[^)]*\)/g, ""), /(^|[^\p{L}])(poți|ai|tău|ta|tale|vrei|știi)(?![\p{L}])/u, "dumneavoastră form");
});

test("every link resolves to a built route; served as text/plain", () => {
  const dist = join(process.cwd(), "dist");
  for (const [, , url] of links) {
    assert.ok(url.startsWith(`${SITE}/`), url);
    const path = url.slice(SITE.length);
    assert.ok(existsSync(join(dist, path, "index.html")), `${path} is not a built page`);
  }
  assert.match(readFileSync("public/_headers", "utf8"), /\/llms\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
});

test("lists TAP-025 desktop till page under Despre Tapselo without pricing", () => {
  const line = links.find((m) => m[2] === `${SITE}/program-casa-de-marcat-pe-calculator/`);
  assert.ok(line, "missing program-casa-de-marcat-pe-calculator in llms.txt");
  assert.equal(line![1], "Program casă de marcat pe calculator");
  assert.doesNotMatch(line![3], /\blei\b|79|129|gratuit/i);
});
