import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LTV_FIXTURE = path.join(__dirname, "../../fixtures/a4200/pdf/signed-with-ltv-tail.pdf");

const STEP3_ORDER_IDS = [
  "a4200-pdf-download",
  "a4200-signed-upload-wrap",
  "a4200-signed-result-wrap",
  "a4200-anaf-troubleshoot",
  "a4200-step3-advanced",
];

export async function goToStep3PdfReady(page) {
  await page.waitForFunction(() => typeof window.__a4200E2E?.goToStep3PdfReady === "function");
  await page.evaluate(() => window.__a4200E2E.goToStep3PdfReady());
}

export async function uploadLtvSignedPdf(page) {
  await page.locator("#a4200-signed-pdf-input").setInputFiles(LTV_FIXTURE);
  await page.waitForFunction(
    () => {
      const strip = document.getElementById("a4200-strip-msg");
      const dl = document.getElementById("a4200-anaf-ready-download");
      const upload = document.getElementById("a4200-signed-upload-wrap");
      const result = document.getElementById("a4200-signed-result-wrap");
      return (
        strip &&
        !strip.hidden &&
        strip.textContent?.includes("eliminat") &&
        dl &&
        !dl.hidden &&
        !!dl.getAttribute("href") &&
        upload &&
        !upload.hidden &&
        result &&
        !result.hidden
      );
    },
    { timeout: 15000 },
  );
}

export async function assertStep3DomOrder(page) {
  const ok = await page.evaluate((ids) => {
    const step = document.getElementById("a4200-step-3");
    if (!step) return false;
    const positions = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el || !step.contains(el)) return -1;
      const all = [...step.querySelectorAll("*")];
      return all.indexOf(el);
    });
    if (positions.some((p) => p < 0)) return false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] <= positions[i - 1]) return false;
    }
    return true;
  }, STEP3_ORDER_IDS);
  assert.equal(ok, true, "step 3 block order must match wizard spec");
}

export async function hideStickyWizardChrome(page) {
  await page.evaluate(() => {
    document.querySelector("#a4200-checker .sticky")?.classList.add("hidden");
  });
}

/** Full bounding box of #a4200-step-3 (not viewport-cropped). */
export async function screenshotStep3Section(page, outPath) {
  await hideStickyWizardChrome(page);
  const step3 = page.locator("#a4200-step-3");
  await step3.scrollIntoViewIfNeeded();
  const box = await step3.boundingBox();
  assert.ok(box, "step 3 section must have a bounding box");
  await page.screenshot({ path: outPath, clip: box });
}
