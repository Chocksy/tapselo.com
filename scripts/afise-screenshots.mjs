import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

function chromiumExecutable() {
  if (process.env.PW_CHROMIUM_EXECUTABLE) return process.env.PW_CHROMIUM_EXECUTABLE;
  const cache = join(homedir(), ".cache", "ms-playwright");
  const candidates = [
    join(cache, "chromium_headless_shell-1248", "chrome-headless-shell-linux64", "chrome-headless-shell"),
    join(cache, "chromium-1248", "chrome-linux", "chrome"),
  ];
  return candidates.find((p) => existsSync(p));
}

const outDir = join(process.cwd(), "docs/pr-screenshots/afise-obligatorii");
const base = "http://127.0.0.1:4321/unelte/afise-obligatorii-magazin/";

async function main() {
  await mkdir(outDir, { recursive: true });
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });

  const shots = [
    { id: "casa_marcat", file: "casa-marcat.png" },
    { id: "anpc", file: "anpc.png" },
    { id: "program", file: "program.png" },
  ];

  for (const { id, file } of shots) {
    const checkbox = page.locator(`input[data-sign-id="${id}"]`);
    await checkbox.check({ force: true });
  }

  await page.locator("#ao-preview").waitFor({ state: "visible" });
  await page.waitForTimeout(500);

  for (const { id, file } of shots) {
    const card = page.locator(`[data-sign="${id}"]`).first();
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: join(outDir, file) });
  }

  await browser.close();
  console.log("Saved screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
