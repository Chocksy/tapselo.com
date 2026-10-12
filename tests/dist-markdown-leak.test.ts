// Run after `npm run build` — no raw markdown markers in /ghid/ and /unelte/ HTML.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ghidUneltePathsFromDist, listHtmlFiles } from "./seo-crawl-lib.ts";

const distDir = join(process.cwd(), "dist");

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function visibleText(html: string): string {
  return stripScriptsAndStyles(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("dist exists (run astro build first)", () => {
  assert.ok(existsSync(distDir), "missing dist/ — run npm run build");
});

test("built /ghid/ and /unelte/ pages do not leak markdown heading or bold markers", async () => {
  const files = await listHtmlFiles(distDir);
  const paths = ghidUneltePathsFromDist(distDir, files);
  const leaks: string[] = [];

  for (const p of paths) {
    const file = join(distDir, p.replace(/^\//, ""), "index.html");
    const html = await readFile(file, "utf8");
    if (/<p>\s*#{2,3}\s/m.test(html)) {
      leaks.push(`${p}: literal ##/### in <p>`);
    }
    const text = visibleText(html);
    if (/\*\*[^*]+\*\*/.test(text)) {
      leaks.push(`${p}: literal **bold** markers`);
    }
    if (/<p>\s*[-*]\s+\S/.test(html)) {
      leaks.push(`${p}: literal list marker in <p>`);
    }
  }

  assert.equal(leaks.length, 0, leaks.join("\n"));
});
