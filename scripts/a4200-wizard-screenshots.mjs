import { chromium, devices } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = "/opt/cursor/artifacts/screenshots";
const fixtureZip = path.join(root, "tests/fixtures/a4200/anon-upload.zip");
const baseUrl = "http://127.0.0.1:4321/ghid/verificare-a4200";

function waitForServer(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error("Server timeout"));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4321"], {
  cwd: root,
  stdio: "ignore",
});

await waitForServer("http://127.0.0.1:4321/");

const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const browser = await chromium.launch();

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.screenshot({ path: `${outDir}/a4200-step1-${vp.name}.png`, fullPage: true });

  const fileInput = page.locator("#a4200-file-input");
  await fileInput.setInputFiles(fixtureZip);
  await page.locator("#a4200-step-1-next").click();
  await page.locator("#a4200-step-2-result").waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/a4200-step2-${vp.name}.png`, fullPage: true });

  const continueBtn = page.locator("#a4200-step-2-next");
  if (await continueBtn.isEnabled()) {
    await continueBtn.click();
    await page.locator("#a4200-step-3-title").waitFor();
    await page.screenshot({ path: `${outDir}/a4200-step3-${vp.name}.png`, fullPage: true });

    await page.evaluate(() => {
      const btn = document.getElementById("a4200-step-3-next");
      if (btn) btn.disabled = false;
    });
    await page.locator("#a4200-step-3-next").click();
    await page.locator("#a4200-step-4-title").waitFor();
    await page.screenshot({ path: `${outDir}/a4200-step4-${vp.name}.png`, fullPage: true });
  }

  await context.close();
}

await browser.close();
preview.kill("SIGTERM");
console.log("Screenshots saved to", outDir);
