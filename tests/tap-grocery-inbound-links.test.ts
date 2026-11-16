// Run after `npm run build`. Brief §B inbound links to the grocery POS page.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TARGET = "/program-casa-de-marcat-magazin-alimentar/";
const home = readFileSync(join(process.cwd(), "dist/index.html"), "utf8");
const minimarket = readFileSync(join(process.cwd(), "dist/ghid/deschide-minimarket-alimentara/index.html"), "utf8");
const gestiune = readFileSync(join(process.cwd(), "dist/program-gestiune-magazin/index.html"), "utf8");

const articleBody = (html: string) => {
  const m = /<main\b[\s\S]*?<\/main>/i.exec(html);
  return m ? m[0] : html;
};

test("minimarket guide links to grocery POS page in article body", () => {
  assert.match(articleBody(minimarket), new RegExp(`href="${TARGET.replace(/\//g, "\\/")}"`));
});

test("program gestiune magazin links to grocery POS page in article body", () => {
  assert.match(articleBody(gestiune), new RegExp(`href="${TARGET.replace(/\//g, "\\/")}"`));
});

test("homepage mega-menu Magazin alimentar points to grocery POS page", () => {
  assert.match(home, new RegExp(`<a[^>]+href="${TARGET.replace(/\//g, "\\/")}"[^>]*>[\\s\\S]*?Magazin alimentar`));
});

test("homepage footer Pentru — Magazin alimentar points to grocery POS page", () => {
  const footer = /<footer class="ft\b[\s\S]*?<\/footer>/i.exec(home)?.[0] ?? "";
  assert.match(footer, new RegExp(`href="${TARGET.replace(/\//g, "\\/")}"[^>]*>Magazin alimentar`));
});