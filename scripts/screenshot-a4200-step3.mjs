import { chromium } from "playwright-core";
import path from "node:path";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { execSync } from "node:child_process";
import {
  assertStep3DomOrder,
  goToStep3PdfReady,
  screenshotStep3Section,
  uploadLtvSignedPdf,
} from "../tests/e2e/lib/a4200-step3-flow.mjs";

const outDir = "/opt/cursor/artifacts";
const distDir = resolve("dist-a4200-e2e");
const mode = process.argv[2] ?? "after";
const prefix = mode === "before" ? "before" : "after";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

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

if (!existsSync(join(distDir, "ghid/verificare-a4200/index.html"))) {
  execSync(
    "PUBLIC_E2E_A4200_HARNESS=1 PUBLIC_A4200_PDF_URL=https://pdf.test astro build --outDir dist-a4200-e2e",
    { stdio: "inherit", cwd: resolve(".") },
  );
}

const server = serve(distDir);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome",
});

async function showStep3Default(page) {
  await page.goto(`${base}/ghid/verificare-a4200/`, { waitUntil: "networkidle" });
  await goToStep3PdfReady(page);
}

if (prefix === "before") {
  for (const [name, width] of [["mobile", 390], ["desktop", 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://127.0.0.1:4321/ghid/verificare-a4200`, { waitUntil: "networkidle" }).catch(() => {});
    await page.evaluate(() => {
      for (let s = 1; s <= 4; s++) {
        const panel = document.getElementById(`a4200-step-${s}`);
        if (!panel) continue;
        const show = s === 3;
        panel.classList.toggle("hidden", !show);
        panel.hidden = !show;
      }
    });
    await screenshotStep3Section(page, path.join(outDir, `a4200-step3-${prefix}-${name}.png`));
    await page.close();
  }
} else {
  for (const [name, width] of [["mobile", 390], ["desktop", 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await showStep3Default(page);
    await screenshotStep3Section(page, path.join(outDir, `a4200-step3-${prefix}-${name}.png`));
    await page.close();
  }

  for (const [name, width] of [["mobile", 390], ["desktop", 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    await showStep3Default(page);
    await uploadLtvSignedPdf(page);
    await assertStep3DomOrder(page);
    await screenshotStep3Section(page, path.join(outDir, `a4200-step3-${prefix}-ltv-success-${name}.png`));
    await page.close();
  }
}

await browser.close();
await new Promise((r) => server.close(r));
console.log("saved", prefix);
