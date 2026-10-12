import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const outDir = process.env.OUT_DIR ?? join(process.cwd(), "docs/pr-screenshots/ui-layout");
const phase = process.env.PHASE ?? "after";

const pages = [
  { name: "home", path: "/" },
  { name: "calculator-reducere", path: "/unelte/calculator-reducere/" },
  { name: "dispozitie-de-plata", path: "/unelte/dispozitie-de-plata/" },
  { name: "registru-unic-de-control", path: "/ghid/registru-unic-de-control/" },
  { name: "plafoane-numerar", path: "/ghid/plafoane-numerar/" },
];

const viewports = [
  { tag: "1280", width: 1280, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

const dir = join(outDir, phase);
await mkdir(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const { name, path } of pages) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(300);
    const file = `${name}-${vp.tag}.png`;
    await page.screenshot({ path: join(dir, file), fullPage: true });
    console.log("wrote", join(dir, file));
  }
  await context.close();
}
await browser.close();
