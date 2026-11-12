// Run after `npm run build` — NIR title/H1/lead wording (TAP-NIR-RECEPTIE).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const dist = (p: string) => readFileSync(join(process.cwd(), "dist", p, "index.html"), "utf8");
const PAGE = "unelte/generator-nir";

test("NIR: title, H1, meta și lead cu denumirea oficială", () => {
  const html = dist(PAGE);
  assert.match(
    html,
    /<title>Generator NIR — notă de recepție și constatare de diferențe \(PDF\) \| Tapselo<\/title>/,
  );
  assert.match(html, /<h1[^>]*>Generator NIR: notă de recepție și constatare de diferențe<\/h1>/);
  assert.match(
    html,
    /name="description" content="Generator NIR gratuit: model de notă de recepție și constatare de diferențe \(14-3-1A\) în PDF/,
  );
  assert.match(html, /primești o notă de recepție și constatare de diferențe \(NIR\) printabilă/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/tapselo\.com\/unelte\/generator-nir\/">/,
  );
});

test("NIR: JSON-LD WebApplication cu denumirea oficială", () => {
  const html = dist(PAGE);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  assert.equal(app?.name, "Generator NIR: notă de recepție și constatare de diferențe | Tapselo");
  assert.ok(app?.name?.includes("notă de recepție"));
  assert.match(app?.description ?? "", /14-3-1A/);
});

test("NIR: sitemap lastmod pinned", () => {
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/tapselo\.com\/unelte\/generator-nir\/<\/loc>\s*<lastmod>2026-11-11/,
  );
});
