import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.MOCKUP_BASE_URL ?? "http://127.0.0.1:4321";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts";

const variants = ["a", "b", "c"];
const widths = [1280, 390];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

for (const variant of variants) {
  for (const width of widths) {
    const height = width === 390 ? 1400 : 1100;
    const page = await browser.newPage({ viewport: { width, height } });
    const url = `${baseUrl}/mockups/pricing-gratis/${variant}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("#pricing");
    const section = page.locator("#pricing");
    const fileName = `pricing-${variant.toUpperCase()}-${width}.png`;
    const filePath = path.join(outDir, fileName);
    await section.screenshot({ path: filePath });
    console.log(`saved ${filePath}`);
    await page.close();
  }
}

await browser.close();
