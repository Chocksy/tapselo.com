// Step 3 signed-PDF flow: LTV upload, strip message, ANAF download, DOM order.
// Build: PUBLIC_E2E_A4200_HARNESS=1 PUBLIC_A4200_PDF_URL=https://pdf.test astro build --outDir dist-a4200-e2e
// Run: node --test tests/e2e/a4200-step3-signed-pdf.mjs

import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { test, before, after } from "node:test";
import { chromium } from "playwright-core";
import {
  assertStep3DomOrder,
  goToStep3PdfReady,
  screenshotStep3Section,
  uploadLtvSignedPdf,
} from "./lib/a4200-step3-flow.mjs";

const DIST = resolve(process.argv[2] ?? process.env.E2E_A4200_DIST ?? "dist-a4200-e2e");
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

let server;
let base;
let browser;

function serve(root) {
  return createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) return res.writeHead(301, { Location: `${url.pathname}/` }).end();
      file = join(file, "index.html");
    }
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
}

before(async () => {
  assert.ok(existsSync(join(DIST, "ghid/verificare-a4200/index.html")), `missing ${DIST} — run e2e build first`);
  server = serve(DIST);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true, executablePath: CHROME });
});

after(async () => {
  await browser?.close();
  await new Promise((r) => server?.close(r));
});

test("step 3: LTV signed PDF shows strip message and ANAF download in order", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(`${base}/ghid/verificare-a4200/`, { waitUntil: "networkidle" });
  await goToStep3PdfReady(page);
  await uploadLtvSignedPdf(page);
  await assertStep3DomOrder(page);

  await page.waitForFunction(() => {
    const t = document.getElementById("a4200-anaf-troubleshoot");
    const u = document.getElementById("a4200-signed-upload-wrap");
    const r = document.getElementById("a4200-signed-result-wrap");
    if (!t || !u || !r) return false;
    return (
      u.compareDocumentPosition(r) === Node.DOCUMENT_POSITION_FOLLOWING &&
      r.compareDocumentPosition(t) === Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  const strip = page.locator("#a4200-strip-msg");
  assert.ok(await strip.isVisible());
  assert.match(await strip.textContent(), /eliminat datele adăugate după semnare/);
  assert.ok(await page.locator("#a4200-anaf-ready-download").isVisible());
  await page.close();
});
