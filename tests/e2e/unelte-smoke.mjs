// Browser smoke test for /unelte at a 390px phone viewport: math, print/PDF popups, poster,
// .xlsx download, barcode lookup and XSS. Builds with the default config, so the barcode box
// calls the same-origin GET /api/barcodes/{ean}; the test answers it in the browser:
//   npm run test:e2e
// Env: CHROME_PATH (default /usr/local/bin/google-chrome), SCREENSHOT_DIR (optional).

import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { test, before, after } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { chromium } from "playwright-core";

const DIST = resolve(process.argv[2] ?? process.env.E2E_DIST ?? "dist-e2e");
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const SHOTS = process.env.SCREENSHOT_DIR;
const EVIL = `<img src=x onerror="window.__xss=1">`;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };

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

const BARCODES = {
  "5941234000013": { status: 200, body: { ean: "5941234000013", name: `Telemea ${EVIL} 1KG=62,00LEI`, brand: "Local", category: "Lactate", vat_rate: 11, price: 24.8, shop: "X" } },
  "5941234000020": { status: 404 },
  "5941234000037": { status: 429 },
  "5941234000044": { status: 400 },
  "5941234000051": { status: 500 },
};

async function phonePage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ro-RO", acceptDownloads: true });
  const calls = [];
  await ctx.route("**/api/barcodes/*", (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, base, "barcode lookup is same-origin");
    const ean = url.pathname.split("/").pop();
    calls.push(ean);
    const r = BARCODES[ean] ?? { status: 404 };
    return route.fulfill({ status: r.status, contentType: "application/json", body: r.body ? JSON.stringify(r.body) : "" });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, calls, errors };
}

async function open(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${path}: horizontal overflow of ${overflow}px at 390px`);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `${path.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "home"}-390.png`), fullPage: true });
  }
}

async function popupFrom(page, selector) {
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click(selector)]);
  await popup.waitForLoadState();
  await popup.waitForSelector(".doc-title");
  return popup;
}

async function assertPrintButtonWorks(popup) {
  await popup.evaluate(() => {
    window.print = () => {
      window.__printed = true;
    };
  });
  await popup.click("#print-btn");
  assert.equal(await popup.evaluate(() => window.__printed), true, "Printează / Salvează PDF calls window.print()");
}

before(async () => {
  assert.ok(existsSync(join(DIST, "unelte/index.html")), `${DIST} has no /unelte build; run npm run test:e2e`);
  assert.ok(existsSync(CHROME), `Chrome not found at ${CHROME}; set CHROME_PATH`);
  server = serve(DIST);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  server?.close();
});

test("hub: five tools, footer link only", async () => {
  const { ctx, page } = await phonePage();
  await open(page, "/unelte/");
  assert.equal(await page.locator("main li a").count(), 5);
  assert.equal(await page.locator('nav a[href="/unelte"], header a[href="/unelte"]').count(), 0, "no Unelte link in the header");
  assert.equal(await page.locator('footer a[href="/unelte"]').count(), 1);
  assert.match(await page.textContent("main"), /cota TVA după codul de bare EAN/);
  await ctx.close();
});

test("calculator TVA: add / remove, Romanian numbers", async () => {
  const { ctx, page, errors } = await phonePage();
  await open(page, "/unelte/calculator-tva/");
  assert.equal(await page.textContent("h1"), "Calculator TVA 21% și 11%");
  assert.equal(await page.locator("[data-vat-rate]").count(), 2);
  await page.fill("#vat-amount", "1.234,50");
  assert.match(await page.textContent("#vat-result"), /1\.493,75/);
  await page.click('[data-vat-mode="remove"]');
  await page.click('[data-vat-rate="11"]');
  await page.fill("#vat-amount", "100");
  const r = await page.textContent("#vat-result");
  assert.match(r, /90,09/);
  assert.match(r, /9,91/);
  await page.fill("#vat-amount", "12 lei");
  assert.match(await page.textContent("#vat-result"), /Suma nu este validă/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("calculator TVA: barcode lookup validates, escapes and maps errors", async () => {
  const { ctx, page, calls } = await phonePage();
  await open(page, "/unelte/calculator-tva/");
  assert.equal(await page.isVisible("#vat-barcode-block"), true);

  for (const [code, msg] of [
    ["5941234000014", /EAN-13 de 13 cifre/],
    ["96385074", /EAN-13 de 13 cifre/],
    ["2000000000008", /coduri interne de magazin/],
  ]) {
    await page.fill("#vat-ean", code);
    await page.click("#vat-ean-search");
    assert.match(await page.textContent("#vat-ean-err"), msg, code);
  }
  assert.deepEqual(calls, [], "codes the endpoint would reject never reach it");

  await page.fill("#vat-ean", "5941234000013");
  await page.click("#vat-ean-search");
  await page.waitForSelector("#vat-ean-result p");
  const card = await page.textContent("#vat-ean-result");
  assert.match(card, /Telemea <img src=x onerror="window.__xss=1">/);
  assert.match(card, /11%/);
  assert.doesNotMatch(card, /24,8|62,00|lei/i);
  assert.doesNotMatch(card, /\bX\b/);
  assert.equal(await page.evaluate(() => window.__xss), undefined);

  const expect = [
    ["5941234000020", /Nu am găsit produsul în baza de date Tapselo/],
    ["5941234000037", /Prea multe căutări/],
    ["5941234000044", /EAN-13 de 13 cifre/],
    ["5941234000051", /nu răspunde acum/],
  ];
  for (const [ean, msg] of expect) {
    await page.fill("#vat-ean", ean);
    await page.click("#vat-ean-search");
    await page.waitForFunction(() => !document.querySelector("#vat-ean-search")?.hasAttribute("disabled"));
    assert.match(await page.textContent("#vat-ean-err"), msg, ean);
  }
  await ctx.close();
});

test("registru de casă: totals on screen, PDF popup, numeric .xlsx", async () => {
  const { ctx, page, errors } = await phonePage();
  await open(page, "/unelte/registru-de-casa/");
  await page.fill("#cb-company", "Magazin Ana SRL");
  await page.fill("#cb-opening", "1.250,40");
  const rows = page.locator("#cb-rows tr");
  await rows.nth(0).locator('[data-f="doc"]').fill("Z 12");
  await rows.nth(0).locator('[data-f="annexes"]').fill("1");
  await rows.nth(0).locator('[data-f="desc"]').fill(EVIL);
  await rows.nth(0).locator('[data-f="rec"]').fill("3.480,20");
  await rows.nth(1).locator('[data-f="doc"]').fill("DP 18");
  await rows.nth(1).locator('[data-f="desc"]').fill("Plată furnizor");
  await rows.nth(1).locator('[data-f="pay"]').fill("1.120");
  const summary = await page.textContent("#cb-summary");
  assert.match(summary, /3\.480,20/);
  assert.match(summary, /3\.610,60/);
  assert.equal(await rows.nth(1).locator('[data-f="pay"]').getAttribute("aria-label"), "Plăți, rândul 2");

  const popup = await popupFrom(page, "#cb-pdf");
  const doc = await popup.content();
  assert.equal(await popup.textContent(".doc-title"), "Registrul de casă");
  assert.match(doc, /<td class="num">3\.480,20<\/td>/);
  assert.match(doc, /<td class="num">3\.610,60<\/td>/);
  assert.match(doc, /Report\/Sold ziua precedentă/);
  assert.doesNotMatch(doc, /Raportează abuz/);
  assert.equal(await popup.evaluate(() => window.__xss), undefined);
  assert.equal(await popup.evaluate(() => window.opener), null);
  await assertPrintButtonWorks(popup);
  await popup.close();

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#cb-xls")]);
  assert.match(download.suggestedFilename(), /^registru-de-casa-\d{8}\.xlsx$/);
  const sheet = strFromU8(unzipSync(new Uint8Array(await readFile(await download.path())))["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /<v>3480\.2<\/v>/);
  assert.match(sheet, /<v>3610\.6<\/v>/);

  await page.fill("#cb-opening", "60.000");
  assert.match(await page.textContent("#cb-summary"), /depășește plafonul de casă de 50\.000,00 lei/);
  await rows.nth(1).locator('[data-f="pay"]').fill("1,2,3");
  assert.match(await page.textContent("#cb-summary"), /Suma de pe rândul 2 nu este validă/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("generator NIR: received quantity, PDF popup, escaping", async () => {
  const { ctx, page, errors } = await phonePage();
  await open(page, "/unelte/generator-nir/");
  await page.fill("#nir-company", "Magazin Ana SRL");
  await page.fill("#nir-supplier", EVIL);
  await page.fill("#nir-number", "17");
  await page.fill("#nir-inv", "LB 4512");
  await page.fill("#nir-markup", "25");
  const row = page.locator("#nir-rows tr").first();
  await row.locator('[data-f="name"]').fill("Lapte 1L");
  await row.locator('[data-f="unit"]').fill("buc");
  await row.locator('[data-f="qty"]').fill("24");
  await row.locator('[data-f="rec"]').fill("20");
  await row.locator('[data-f="cost"]').fill("5,40");
  await row.locator('[data-f="vat"]').selectOption("11");
  assert.match(await page.textContent("#nir-summary"), /108,00/);

  const popup = await popupFrom(page, "#nir-pdf");
  const doc = await popup.content();
  assert.equal(await popup.textContent(".doc-title"), "Notă de recepție și constatare de diferențe (NIR)");
  assert.match(doc, /<b>NIR nr\.:<\/b> 17/);
  assert.match(doc, /<td class="num">24<\/td>\n<td class="num">20<\/td>/);
  assert.match(doc, /Diferențe la recepție/);
  assert.equal(await popup.evaluate(() => window.__xss), undefined);
  await assertPrintButtonWorks(popup);
  await popup.close();

  await page.fill("#nir-number", "");
  await page.click("#nir-pdf");
  assert.match(await page.textContent("#nir-err"), /NIR/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("calculator adaos: 20% food cap with rounding, reverse mode, poster opt-in", async () => {
  const { ctx, page, errors } = await phonePage();
  await open(page, "/unelte/calculator-adaos-comercial/");
  await page.fill("#mk-cost", "2");
  await page.fill("#mk-markup", "20");
  await page.selectOption("#mk-vat", "11");
  await page.selectOption("#mk-round", "0.49_0.99");
  await page.check("#mk-food");
  const r = await page.textContent("#mk-result");
  assert.match(r, /2,99 lei/);
  assert.match(r, /Rotunjirea ridică adaosul la 34,68%, peste plafonul de 20%.*2,49 lei/);
  await page.selectOption("#mk-round", "none");
  assert.doesNotMatch(await page.textContent("#mk-result"), /plafon/);

  await page.fill("#mk-store", "Magazin Ana");
  await page.fill("#mk-product", EVIL);
  let popup = await popupFrom(page, "#mk-afis");
  let doc = await popup.textContent("main");
  assert.equal(await popup.textContent(".doc-title"), "Informare preț");
  assert.doesNotMatch(doc, /Cost de achiziție|Adaos comercial/);
  assert.equal(await popup.evaluate(() => window.__xss), undefined);
  await popup.close();
  await page.check("#mk-show-cost");
  await page.check("#mk-show-markup");
  popup = await popupFrom(page, "#mk-afis");
  doc = await popup.textContent("main");
  assert.match(doc, /Cost de achiziție \(fără TVA\)\s*2,00 lei/);
  assert.match(doc, /Adaos comercial\s*19,82%/);
  await popup.close();

  await page.click('[data-dir="reverse"]');
  await page.fill("#mk-cost", "10");
  await page.fill("#mk-sale", "14,43");
  const rev = await page.textContent("#mk-result");
  assert.match(rev, /30,00%/);
  assert.match(rev, /23,08%/);
  await page.click("#mk-afis");
  assert.match(await page.textContent("#mk-afis-err"), /Cost → preț de vânzare/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
