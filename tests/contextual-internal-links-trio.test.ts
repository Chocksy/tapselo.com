// Run after `npm run build`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const dist = join(process.cwd(), "dist");
const punctGuide = '/ghid/declarare-punct-de-lucru-anaf/';
const fridgeTool = "/unelte/grafic-temperatura-frigider/";

function readPage(subpath: string): string {
  return readFileSync(join(dist, subpath, "index.html"), "utf8");
}

function assertContextLink(html: string, href: string, anchor: string) {
  const esc = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(html, new RegExp(`<a href="${href.replace(/\//g, "\\/")}"[^>]*>${esc}</a>`));
}

const deschideGuides = [
  "ghid/deschide-minimarket-alimentara",
  "ghid/deschide-cafenea-bistro",
  "ghid/deschide-macelarie",
  "ghid/deschide-brutarie-patiserie",
  "ghid/deschide-legume-fructe",
  "ghid/deschide-magazin-nealimentar",
];

const foodGuides = deschideGuides.filter((p) => p !== "ghid/deschide-magazin-nealimentar");

test("TAP-ILINKS-TRIO: 12 contextual internal links in built HTML", () => {
  for (const page of deschideGuides) {
    const html = readPage(page);
    assertContextLink(html, punctGuide, "punctul de lucru");
  }

  const ruc = readPage("ghid/registru-unic-de-control");
  assertContextLink(ruc, punctGuide, "punct de lucru autorizat separat");

  for (const page of foodGuides) {
    const html = readPage(page);
    assertContextLink(html, fridgeTool, "temperatură");
  }
});
