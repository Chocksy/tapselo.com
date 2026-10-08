// Run after `npm run build` — validates dist/ link hygiene and sitemap coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  crawlDist,
  ghidUneltePathsFromDist,
  linkDepthFromHome,
  listHtmlFiles,
  parseSitemapUrls,
} from "./seo-crawl-lib.ts";

const distDir = join(process.cwd(), "dist");

test("dist exists (run astro build first)", () => {
  assert.ok(existsSync(distDir), "missing dist/ — run npm run build");
});

test("internal links: no utm_, no slash redirects, no email-protection URLs", async () => {
  const issues = await crawlDist(distDir);
  const utm = issues.filter((i) => i.kind === "utm");
  const slash = issues.filter((i) => i.kind === "no_slash");
  const email = issues.filter((i) => i.kind === "email_protection");
  assert.equal(utm.length, 0, `utm links: ${utm.slice(0, 3).map((i) => `${i.from} -> ${i.href}`).join("; ")}`);
  assert.equal(slash.length, 0, `no-slash links: ${slash.slice(0, 5).map((i) => i.href).join(", ")}`);
  assert.equal(email.length, 0, `email-protection: ${email.slice(0, 3).map((i) => i.href).join(", ")}`);
});

test("every /ghid/ and /unelte/ page within 2 clicks of homepage", async () => {
  const files = await listHtmlFiles(distDir);
  const paths = ghidUneltePathsFromDist(distDir, files);
  const depth = await linkDepthFromHome(distDir);
  const tooDeep = paths.filter((p) => (depth.get(p) ?? 999) > 2);
  assert.equal(tooDeep.length, 0, `unreachable in ≤2 clicks: ${tooDeep.join(", ")}`);
});

test("sitemap lists every /ghid/ and /unelte/ page", async () => {
  const files = await listHtmlFiles(distDir);
  const paths = ghidUneltePathsFromDist(distDir, files);
  const sitemap = await parseSitemapUrls(distDir);
  const missing = paths.filter((p) => !sitemap.has(p));
  assert.equal(missing.length, 0, `missing from sitemap: ${missing.join(", ")}`);
});
