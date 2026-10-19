// Builds the static blank "Borderou de achiziție" (cod 14-4-13) files served from
// /unelte/formulare/: A4 and A5 PDFs plus a PNG preview for the tool page.
// Same renderer as the /unelte/generator-borderou-de-achizitie generator (renderPurchaseSlip,
// blank mode), printed by headless Chrome. Re-run after changing src/lib/generators/purchase-slip.ts:
//   node --experimental-strip-types scripts/build-borderou-blank-pdf.mjs
// Env: CHROME_PATH (default /usr/local/bin/google-chrome).
// TODO: fold into scripts/build-blank-forms.mjs (PR #59) as a FORMS entry
//   borderou: { base: "borderou-de-achizitie-14-4-13", html: (size) => purchaseSlipHtml(BLANK_PURCHASE_SLIP, size, true) }

import { mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { BLANK_PURCHASE_SLIP } from "../src/lib/generators/purchase-slip.ts";
import { purchaseSlipHtml } from "../src/lib/unelte/document-export.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/unelte/formulare");
const BASE = "borderou-de-achizitie-14-4-13";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
/** Preview width in CSS px; the page shows it at this size (keep in sync with the <img> width/height). */
const PREVIEW_WIDTH = 600;
const html = (size) => purchaseSlipHtml(BLANK_PURCHASE_SLIP, size, true);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const size of ["A4", "A5"]) {
    const page = await browser.newPage();
    await page.setContent(html(size), { waitUntil: "load" });
    const file = join(OUT, `${BASE}-${size.toLowerCase()}.pdf`);
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true, tagged: true });
    console.log(`${file} ${statSync(file).size} B`);
    await page.close();
  }

  // Preview: the A4 sheet as it prints (print CSS), scaled to PREVIEW_WIDTH.
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: PREVIEW_WIDTH / 794 });
  await page.emulateMedia({ media: "print" });
  await page.setContent(html("A4"), { waitUntil: "load" });
  await page.addStyleTag({ content: "body{margin:0;background:#fff}.sheet{padding:10mm;width:794px}" });
  const sheet = page.locator("main.sheet");
  const file = join(OUT, `${BASE}-preview.png`);
  await sheet.screenshot({ path: file, animations: "disabled" });
  const box = await sheet.boundingBox();
  console.log(`${file} ${statSync(file).size} B, ${Math.round((box.width * PREVIEW_WIDTH) / 794)}x${Math.round((box.height * PREVIEW_WIDTH) / 794)}`);
  await page.close();
} finally {
  await browser.close();
}
