// Builds the site WITH a pixel ID and proves Meta code ships on /demo/ only.
// The normal build (no ID) must have no Meta code anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

// tapselo_marketing_consent is not listed: „Retrage acordul” (footer, every page) must write it as denied.
const META = /fbevents|connect\.facebook\.net|meta-capi|data-meta-consent|\bfbq\b/;

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(n)) out.push(p);
  }
  return out;
}

function scriptsOf(dir: string, html: string): string {
  return [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+\.js)"/g)].map((m) => readFileSync(join(dir, m[1]), "utf8")).join("\n");
}

/** Pages whose HTML or own JS contains Meta code. */
function metaPages(dir: string): string[] {
  const hit: string[] = [];
  for (const f of files(dir, /\.html$/)) {
    const html = readFileSync(f, "utf8");
    // Code only: inline <script>s, the page's JS files and the consent box markup. Prose (e.g. /privacy
    // describing the pixel) is not code.
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    if (/data-meta-consent/.test(html) || META.test(inline) || META.test(scriptsOf(dir, html))) hit.push(relative(dir, f));
  }
  return hit;
}

test("default build (no PUBLIC_META_PIXEL_ID): no Meta code on any page", () => {
  assert.deepEqual(metaPages(join(process.cwd(), "dist")), []);
});

test("build with PUBLIC_META_PIXEL_ID: Meta code only on demo/index.html", { timeout: 240_000 }, () => {
  const out = mkdtempSync(join(tmpdir(), "meta-scope-"));
  execFileSync(process.execPath, ["node_modules/astro/bin/astro.mjs", "build", "--outDir", out], {
    env: { ...process.env, PUBLIC_META_PIXEL_ID: "1234567890" },
    stdio: "pipe",
  });
  assert.deepEqual(metaPages(out), ["demo/index.html"]);
});
