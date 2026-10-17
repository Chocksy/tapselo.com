#!/usr/bin/env node
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.SHOT_OUT_DIR ?? "artifacts/screenshots";
const LABEL = process.env.SHOT_LABEL ?? "run";

const viewports = [
  { id: "desktop-1280", width: 1280, height: 900 },
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
];

async function shotLocator(locator, file) {
  await locator.screenshot({ path: file });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile ?? false,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(OUT, `${LABEL}-${vp.id}-home-hero-nav.png`),
      clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, vp.isMobile ? 520 : 560) },
    });

    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shotLocator(footer, path.join(OUT, `${LABEL}-${vp.id}-footer.png`));

    await page.goto(`${BASE}/#how-it-works`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(600);
    const hiw = page.locator("#how-it-works");
    await hiw.scrollIntoViewIfNeeded();
    await shotLocator(hiw, path.join(OUT, `${LABEL}-${vp.id}-how-it-works.png`));

    await page.goto(`${BASE}/ghid/articole/casa-de-marcat-fara-internet/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(500);
    const prose = page.locator(".kb-prose").first();
    await prose.scrollIntoViewIfNeeded();
    await shotLocator(prose, path.join(OUT, `${LABEL}-${vp.id}-guide-article-body.png`));

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots saved under ${OUT} (${LABEL})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
