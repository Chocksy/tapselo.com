import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = "/opt/cursor/artifacts/unelte-screenshots";
const BASE = process.env.UNELTE_SCREENSHOT_BASE ?? "http://127.0.0.1:4321";

const pages = [
  { slug: "calculator-tva", file: "calculator-tva.png" },
  { slug: "registru-de-casa", file: "registru-de-casa.png" },
  { slug: "generator-nir", file: "generator-nir.png" },
  { slug: "calculator-adaos-comercial", file: "calculator-adaos.png" },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

for (const p of pages) {
  await page.goto(`${BASE}/unelte/${p.slug}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, p.file), fullPage: true });
  console.log("wrote", p.file);
}

await browser.close();
