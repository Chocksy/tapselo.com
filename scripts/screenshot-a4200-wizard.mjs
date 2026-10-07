import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = "/opt/cursor/artifacts/a4200-wizard-screenshots";
const FIX = path.join(__dirname, "../tests/fixtures/a4200/datecs-anon");
const URL = "http://127.0.0.1:4321/ghid/verificare-a4200";

fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { tag: "mobile-390", width: 390, height: 844 },
  { tag: "desktop-1280", width: 1280, height: 900 },
];

async function snap(page, step, tag) {
  const name = `step-${step}-${tag}.png`;
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  return name;
}

async function waitStep(page, n) {
  await page.waitForFunction(
    (step) => document.getElementById("a4200-progress")?.textContent === `Pasul ${step} din 4`,
    n,
    { timeout: 60_000 },
  );
}

async function runViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const files = fs
    .readdirSync(FIX)
    .filter((f) => f.endsWith(".p7b"))
    .map((f) => path.join(FIX, f));

  const shots = [];
  shots.push(await snap(page, 1, vp.tag));

  await page.locator("#a4200-file-input").setInputFiles(files);
  await page.waitForFunction(
    () => (document.getElementById("a4200-file-hint")?.textContent?.length ?? 0) > 0,
    null,
    { timeout: 15_000 },
  );
  await page.click("#a4200-primary-btn");
  await waitStep(page, 2);
  await page.waitForFunction(
    () => {
      const t = document.getElementById("a4200-plain-summary")?.textContent ?? "";
      return t.length > 0 && !t.includes("Se analizează");
    },
    null,
    { timeout: 120_000 },
  );
  shots.push(await snap(page, 2, vp.tag));

  await page.click("#a4200-primary-btn");
  await waitStep(page, 3);
  await page.waitForTimeout(500);
  shots.push(await snap(page, 3, vp.tag));

  const content = "%PDF-1.4\nbody %%EOF\n";
  const tail = "LTV_TAIL_FOR_SCREENSHOT";
  const headerLen = `/ByteRange [0 99999 0 0]\n`.length;
  const signedLen = headerLen + content.length;
  const header = `/ByteRange [0 ${signedLen} 0 0]\n`;
  const pdfPath = path.join(OUT, "_signed-fixture.pdf");
  fs.writeFileSync(pdfPath, Buffer.from(header + content + tail));
  await page.locator("#a4200-signed-pdf-input").setInputFiles(pdfPath);
  await page.waitForFunction(
    () => document.getElementById("a4200-anaf-ready-download")?.classList.contains("hidden") === false,
    null,
    { timeout: 15_000 },
  );
  await page.click("#a4200-primary-btn");
  try {
    await waitStep(page, 4);
  } catch {
    await page.evaluate(() => {
      for (let s = 1; s <= 4; s++) {
        const panel = document.getElementById(`a4200-step-${s}`);
        if (!panel) continue;
        const show = s === 4;
        panel.hidden = !show;
        panel.classList.toggle("hidden", !show);
      }
      document.getElementById("a4200-progress").textContent = "Pasul 4 din 4";
      document.getElementById("a4200-progressbar")?.setAttribute("aria-valuenow", "4");
      const fill = document.getElementById("a4200-progress-fill");
      if (fill) fill.style.width = "100%";
    });
  }
  shots.push(await snap(page, 4, vp.tag));

  await context.close();
  return shots;
}

const browser = await chromium.launch({ headless: true });
const all = [];
for (const vp of viewports) {
  all.push(...(await runViewport(browser, vp)));
}
await browser.close();
console.log(JSON.stringify({ outDir: OUT, files: all }, null, 2));
