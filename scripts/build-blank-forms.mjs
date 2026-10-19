// Builds the static blank forms served from /unelte/formulare/: A4 and A5 PDFs plus a PNG
// preview for each tool page. Same renderers as the /unelte generators (blank mode), printed
// by headless Chrome. Re-run for a form after changing its renderer in src/lib/generators/:
//   node --experimental-strip-types scripts/build-blank-forms.mjs            (every form)
//   node --experimental-strip-types scripts/build-blank-forms.mjs aviz       (one form)
// Forms: dispozitie (cod 14-4-4, cash-order.ts), aviz (cod 14-3-6A, aviz.ts),
// borderou (cod 14-4-13, purchase-slip.ts).
// Env: CHROME_PATH (default /usr/local/bin/google-chrome).

import { mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { BLANK_AVIZ } from "../src/lib/generators/aviz.ts";
import { BLANK_CASH_ORDER } from "../src/lib/generators/cash-order.ts";
import { BLANK_PURCHASE_SLIP } from "../src/lib/generators/purchase-slip.ts";
import { avizHtml, cashOrderHtml, purchaseSlipHtml } from "../src/lib/unelte/document-export.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/unelte/formulare");
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
/** Preview width in CSS px; the page shows it at this size (keep in sync with the <img> width/height). */
const PREVIEW_WIDTH = 600;

const FORMS = {
  dispozitie: { base: "dispozitie-de-plata-incasare-14-4-4", html: (size) => cashOrderHtml(BLANK_CASH_ORDER, size, true) },
  aviz: { base: "aviz-de-insotire-a-marfii-14-3-6a", html: (size) => avizHtml(BLANK_AVIZ, size, true) },
  borderou: { base: "borderou-de-achizitie-14-4-13", html: (size) => purchaseSlipHtml(BLANK_PURCHASE_SLIP, size, true) },
};

const names = process.argv.slice(2);
for (const n of names) if (!(n in FORMS)) throw new Error(`Formular necunoscut: ${n} (${Object.keys(FORMS).join(", ")})`);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const name of names.length ? names : Object.keys(FORMS)) {
    const { base, html } = FORMS[name];
    for (const size of ["A4", "A5"]) {
      const page = await browser.newPage();
      await page.setContent(html(size), { waitUntil: "load" });
      const file = join(OUT, `${base}-${size.toLowerCase()}.pdf`);
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
    const file = join(OUT, `${base}-preview.png`);
    await sheet.screenshot({ path: file, animations: "disabled" });
    const box = await sheet.boundingBox();
    console.log(`${file} ${statSync(file).size} B, ${Math.round((box.width * PREVIEW_WIDTH) / 794)}x${Math.round((box.height * PREVIEW_WIDTH) / 794)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
