import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4321";
const prefix = process.argv[3] ?? "before";
const mode = process.argv[4] ?? "default";
const outDir = "/opt/cursor/artifacts";

const ltvFixture = path.join(__dirname, "../tests/fixtures/a4200/pdf/signed-with-ltv-tail.pdf");

async function showStep3(page) {
  await page.goto(`${baseUrl}/ghid/verificare-a4200`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (let s = 1; s <= 4; s++) {
      const panel = document.getElementById(`a4200-step-${s}`);
      if (!panel) continue;
      const show = s === 3;
      panel.classList.toggle("hidden", !show);
      panel.hidden = !show;
    }
    const progressLabel = document.getElementById("a4200-progress");
    if (progressLabel) progressLabel.textContent = "Pasul 3 din 4";
    const fill = document.getElementById("a4200-progress-fill");
    if (fill) fill.style.width = "75%";
    const signedWrap = document.getElementById("a4200-signed-upload-wrap");
    if (signedWrap) {
      signedWrap.hidden = false;
      signedWrap.classList.remove("hidden");
    }
    const pdfDl = document.getElementById("a4200-pdf-download");
    if (pdfDl) {
      pdfDl.hidden = false;
      pdfDl.classList.remove("hidden");
      pdfDl.classList.add("inline-flex", "flex");
    }
  });
  await page.waitForTimeout(300);
}

async function showLtvSuccess(page) {
  await showStep3(page);
  const input = page.locator("#a4200-signed-pdf-input");
  await input.setInputFiles(ltvFixture);
  await page.waitForFunction(
    () => {
      const strip = document.getElementById("a4200-strip-msg");
      const dl = document.getElementById("a4200-anaf-ready-download");
      return (
        strip &&
        !strip.hidden &&
        strip.textContent?.includes("eliminat") &&
        dl &&
        !dl.hidden &&
        !!dl.getAttribute("href")
      );
    },
    { timeout: 15000 },
  );
  await page.waitForTimeout(200);
}

const browser = await chromium.launch({ headless: true });

if (mode === "ltv-success") {
  for (const [name, width] of [["mobile", 390], ["desktop", 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await showLtvSuccess(page);
    const step3 = page.locator("#a4200-step-3");
    await step3.screenshot({
      path: path.join(outDir, `a4200-step3-${prefix}-ltv-success-${name}.png`),
    });
    await page.close();
  }
} else {
  for (const [name, width] of [["mobile", 390], ["desktop", 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await showStep3(page);
    const step3 = page.locator("#a4200-step-3");
    await step3.screenshot({
      path: path.join(outDir, `a4200-step3-${prefix}-${name}.png`),
    });
    await page.close();
  }
}

await browser.close();
console.log("saved", prefix, mode);
