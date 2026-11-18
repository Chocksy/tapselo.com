// Headless checks for delegated cta_click (PostHog stub). Build first:
//   npm run test:e2e:cta

import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { test, before, after } from "node:test";
import { chromium } from "playwright-core";

const DIST = resolve(process.env.E2E_DIST ?? "dist-cta-e2e");
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

const INIT = () => {
  window.__TAPSELO_ANALYTICS_E2E__ = true;
  window.__ctaCaptures = [];
  window.__tapseloPostHogBoot = {
    promise: Promise.resolve({
      capture: (event, properties, options) => {
        if (event === "cta_click") window.__ctaCaptures.push({ properties, options });
      },
    }),
    client: {
      capture: (event, properties, options) => {
        if (event === "cta_click") window.__ctaCaptures.push({ properties, options });
      },
    },
  };
};

async function clickAndCapture(page, selector, opts = {}) {
  const { modifiers = [] } = opts;
  await page.evaluate((sel) => {
    const a = document.querySelector(sel);
    if (a) a.addEventListener("click", (e) => e.preventDefault(), { once: true, capture: true });
  }, selector);
  await page.click(selector, { modifiers, noWaitAfter: true });
  await page.waitForTimeout(50);
  return page.evaluate(() => window.__ctaCaptures ?? []);
}

function assertBeaconOptions(caps) {
  assert.equal(caps[0].options?.send_instantly, true);
  assert.equal(caps[0].options?.transport, "sendBeacon");
}

before(async () => {
  assert.ok(existsSync(DIST), `missing build at ${DIST}`);
  await new Promise((resolve, reject) => {
    server = serve(DIST);
    server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    channel: existsSync(CHROME) ? undefined : "chromium",
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

test("cta_click: one event per qualifying click with core properties", async () => {
  const page = await browser.newPage();
  await page.addInitScript(INIT);
  const cases = [
    {
      path: "/",
      selector: "a.sb-cta",
      page_path: "/",
      target: "app-demo",
      location: "header",
    },
    {
      path: "/",
      selector: "a.hm-btn",
      page_path: "/",
      target: "app-demo",
      location: "hero",
    },
    {
      path: "/program-casa-de-marcat-pe-calculator/",
      selector: "main .pg-box a[data-tapselo-cta]",
      page_path: "/program-casa-de-marcat-pe-calculator/",
      target: "demo",
      location: "ghid-program-casa-de-marcat-pe-calculator",
    },
    {
      path: "/ghid/articole/casa-de-marcat-fara-internet/",
      selector: "a.ft-q",
      page_path: "/ghid/articole/casa-de-marcat-fara-internet/",
      target: "demo",
      location: "footer-demo",
    },
    {
      path: "/unelte/calculator-reducere/",
      selector: "a.ft-q",
      page_path: "/unelte/calculator-reducere/",
      target: "demo",
      location: "footer-demo",
    },
  ];

  const recorded = [];
  for (const c of cases) {
    await page.goto(`${base}${c.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.__ctaCaptures = [];
    });
    const caps = await clickAndCapture(page, c.selector);
    assert.equal(caps.length, 1, `${c.path} ${c.selector} should emit one cta_click`);
    assertBeaconOptions(caps);
    const { properties } = caps[0];
    assert.equal(properties.location, c.location);
    assert.equal(properties.page_path, c.page_path);
    assert.equal(properties.target, c.target);
    assert.ok(properties.target_url);
    recorded.push({ path: c.path, selector: c.selector, properties, options: caps[0].options });
  }

  await page.goto(`${base}/ghid/articole/casa-de-marcat-fara-internet/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.__ctaCaptures = [];
  });
  const nonCaps = await clickAndCapture(page, ".kb-prose a[href='/']");
  assert.equal(nonCaps.length, 0, "Încearcă Tapselo → / should not emit cta_click");

  console.log(JSON.stringify(recorded, null, 2));
  await page.close();
});

test("cta_click: double-fire, modifier click, middle-click, queue-before-boot", async () => {
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.__TAPSELO_ANALYTICS_E2E__ = true;
    window.__ctaCaptures = [];
    let resolveBoot;
    const promise = new Promise((resolve) => {
      resolveBoot = resolve;
    });
    const client = {
      capture: (event, properties, options) => {
        if (event === "cta_click") window.__ctaCaptures.push({ properties, options });
      },
    };
    window.__tapseloPostHogBoot = { promise, client: undefined };
    window.__flushCtaBoot = () => {
      window.__tapseloPostHogBoot.client = client;
      resolveBoot(client);
    };
  });

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    window.__ctaCaptures = [];
  });
  await clickAndCapture(page, "a.sb-cta");
  let caps = await page.evaluate(() => window.__ctaCaptures ?? []);
  assert.equal(caps.length, 0, "queued before boot resolves");

  await page.evaluate(() => window.__flushCtaBoot());
  await page.waitForTimeout(50);
  caps = await page.evaluate(() => window.__ctaCaptures ?? []);
  assert.equal(caps.length, 1, "flush queued cta_click after boot");
  assertBeaconOptions(caps);

  await page.waitForTimeout(450);
  await page.evaluate(() => {
    window.__ctaCaptures = [];
  });
  const dbl = await page.evaluate(async () => {
    const a = document.querySelector("a.hm-btn");
    if (!a) return [];
    const stop = (e) => e.preventDefault();
    a.addEventListener("click", stop, { capture: true });
    a.click();
    a.click();
    a.removeEventListener("click", stop, { capture: true });
    await new Promise((r) => setTimeout(r, 50));
    return window.__ctaCaptures ?? [];
  });
  assert.equal(dbl.length, 1, "deduped rapid duplicate clicks on same anchor");

  await page.waitForTimeout(450);
  const modCaps = await page.evaluate(async () => {
    window.__ctaCaptures = [];
    const a = document.querySelector("a.sb-cta");
    if (!a) return [];
    const stop = (e) => e.preventDefault();
    a.addEventListener("click", stop, { capture: true });
    a.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }),
    );
    a.removeEventListener("click", stop, { capture: true });
    await new Promise((r) => setTimeout(r, 50));
    return window.__ctaCaptures ?? [];
  });
  assert.equal(modCaps.length, 1, "ctrl+click still tracks once");
  assertBeaconOptions(modCaps);

  await page.waitForTimeout(450);
  const midCaps = await page.evaluate(async () => {
    window.__ctaCaptures = [];
    const a = document.querySelector("a.sb-cta");
    if (!a) return [];
    const stop = (e) => e.preventDefault();
    a.addEventListener("auxclick", stop, { capture: true });
    a.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    a.removeEventListener("auxclick", stop, { capture: true });
    await new Promise((r) => setTimeout(r, 50));
    return window.__ctaCaptures ?? [];
  });
  assert.equal(midCaps.length, 1, "middle-click (auxclick) tracks once");
  assertBeaconOptions(midCaps);

  await page.waitForTimeout(450);
  const rightAux = await page.evaluate(async () => {
    window.__ctaCaptures = [];
    const a = document.querySelector("a.sb-cta");
    if (!a) return [];
    a.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 2 }));
    await new Promise((r) => setTimeout(r, 50));
    return window.__ctaCaptures ?? [];
  });
  assert.equal(rightAux.length, 0, "auxclick button 2 (right) emits nothing");

  await page.waitForTimeout(450);
  await page.evaluate(() => {
    window.__ctaCaptures = [];
  });
  await page.evaluate(() => {
    const a = document.querySelector("a.hm-btn");
    a?.addEventListener("click", (e) => e.preventDefault(), { once: true, capture: true });
  });
  await page.focus("a.hm-btn");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const enterCaps = await page.evaluate(() => window.__ctaCaptures ?? []);
  assert.equal(enterCaps.length, 1, "keyboard Enter on focused demo CTA emits one cta_click");
  assertBeaconOptions(enterCaps);

  await page.close();
});