#!/usr/bin/env node
/**
 * Screenshots for PR artifacts (fake data only — no live ANAF calls).
 * Run: node extensions/verificare-cui/scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extRoot = join(__dirname, "..");
const outDir = process.env.ARTIFACTS_DIR ?? "/opt/cursor/artifacts";

const MOCK_CUI = "41234567";
const MOCK_COMPANY_HTML = `
<dt>Denumire</dt><dd>EXEMPLU DEMO SRL (fictiv)</dd>
<dt>Adresă</dt><dd>Str. Exemplu nr. 1, București (demo)</dd>
<dt>Plătitor de TVA</dt><dd>nu</dd>
<dt>TVA la încasare</dt><dd>nu</dd>
<dt>Inactiv fiscal</dt><dd>nu</dd>
<dt>Split TVA</dt><dd>nu</dd>
<dt>Registrul RO e-Factura</dt><dd>nu apare în Registrul RO e-Factura</dd>
`.trim();

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 640 } });

  await page.goto(`file://${join(extRoot, "popup.html")}`);
  await page.screenshot({
    path: join(outDir, "verificare-cui-popup-both-tab-labels.png"),
  });

  await page.click('[data-tab="barcode"]');
  await page.screenshot({
    path: join(outDir, "verificare-cui-popup-barcode-panel.png"),
  });

  await page.goto(`file://${join(extRoot, "demo/demo-page.html")}`);
  await page.evaluate(
    ({ cui, html }) => {
      const host = document.createElement("div");
      host.id = "tapselo-verificare-cui-card-host";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          .wrap {
            position: fixed;
            top: 180px;
            left: 24px;
            z-index: 9999;
            width: 300px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            box-shadow: 0 10px 40px rgba(15, 23, 42, 0.18);
            padding: 0.65rem 0.75rem;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            color: #0f172a;
          }
          .title { font-weight: 600; margin: 0 0 0.25rem; }
          .sub { font-size: 0.75rem; color: #64748b; font-family: ui-monospace, monospace; margin: 0 0 0.5rem; }
          dt { font-weight: 600; margin-top: 0.35rem; font-size: 0.8rem; }
          dd { margin: 0.1rem 0 0; color: #64748b; font-size: 0.8rem; }
          .ftr { margin-top: 0.5rem; font-size: 0.65rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.5rem; }
        </style>
        <div class="wrap" role="dialog" aria-label="Verificare CUI ANAF">
          <p class="title">Verificare CUI ANAF</p>
          <p class="sub">CUI ${cui}</p>
          <dl>${html}</dl>
          <p class="ftr">Date publice ANAF · captură demo (API mock)</p>
        </div>
      `;
      document.documentElement.append(host);
    },
    { cui: MOCK_CUI, html: MOCK_COMPANY_HTML },
  );
  await page.screenshot({
    path: join(outDir, "verificare-cui-inpage-card-demo.png"),
    fullPage: true,
  });

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
