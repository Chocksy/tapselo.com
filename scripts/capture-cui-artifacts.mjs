import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = "/opt/cursor/artifacts";
const root = dirname(fileURLToPath(import.meta.url));
const extBase = "http://127.0.0.1:8765";
const fixturePath = join(root, "../tests/fixtures/anaf-v9-sample.json");
const fixture = readFileSync(fixturePath, "utf8");
const fixtureCompany = JSON.parse(fixture).found[0];
const mapped = {
  cui: "14399840",
  name: fixtureCompany.date_generale.denumire,
  address: fixtureCompany.date_generale.adresa,
  registration_number: fixtureCompany.date_generale.nrRegCom,
  caen: fixtureCompany.date_generale.cod_CAEN,
  status: fixtureCompany.date_generale.stare_inregistrare,
  vat_payer: true,
  vat_on_cash: false,
  split_vat: false,
  inactive: false,
  deregistered_on: null,
  efactura_registry: false,
  efactura_since: null,
  date: fixtureCompany.date_generale.data,
};

await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });

const page = await browser.newPage({ viewport: { width: 400, height: 720 } });
await page.addInitScript(() => {
  const mk = () => {
    const bag = {};
    return {
      get(keys, cb) {
        const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys ?? {});
        const out = {};
        for (const k of list) if (bag[k]) out[k] = bag[k];
        if (typeof cb === "function") cb(out);
        return Promise.resolve(out);
      },
      set(obj, cb) {
        Object.assign(bag, obj);
        if (typeof cb === "function") cb();
        return Promise.resolve();
      },
      remove(keys, cb) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) delete bag[k];
        if (typeof cb === "function") cb();
        return Promise.resolve();
      },
    };
  };
  globalThis.chrome = { storage: { local: mk(), session: mk() } };
});
await page.route("**/PlatitorTvaRest/v9/tva", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: fixture });
});

await page.goto(`${extBase}/popup.html`);
await page.screenshot({ path: join(out, "extension-popup-empty.png") });

await page.fill("#cui-input", "14399840");
await page.click('button[type="submit"]');
await page.waitForSelector("#cui-result:not([hidden])", { timeout: 5000 });
const extText = await page.locator("#cui-result").innerText();
if (!extText.includes("DANTE")) {
  throw new Error(`extension results missing company name: ${extText.slice(0, 120)}`);
}
await page.screenshot({ path: join(out, "extension-popup-results.png") });

const web = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await web.route("**/api/anaf/cui/**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(mapped),
  });
});

await web.goto("http://127.0.0.1:4321/unelte/verificare-cui/", { waitUntil: "networkidle" });
await web.screenshot({ path: join(out, "web-tool-verificare-cui.png"), fullPage: true });

await web.fill("#cui-input", "14399840");
await web.click("#cui-search");
await web.waitForSelector("#cui-results:not(.hidden)", { timeout: 5000 });
const webText = await web.locator("#cui-result").innerText();
if (!webText.includes("DANTE")) {
  throw new Error(`web results missing company name: ${webText.slice(0, 120)}`);
}
await web.screenshot({ path: join(out, "web-tool-verificare-cui-results.png"), fullPage: true });

await browser.close();
console.log("Saved verified screenshots to", out);
