// Browser test for the homepage contact form's Turnstile handling (no network: api.js and
// /api/contact are answered in the browser by a fake widget and a stub endpoint).
//   npm run test:e2e:contact
// Env: CHROME_PATH (default /usr/local/bin/google-chrome), SCREENSHOT_DIR (optional).

import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { test, before, after } from "node:test";
import { chromium } from "playwright-core";

const DIST = resolve(process.argv[2] ?? process.env.E2E_DIST ?? "dist-e2e");
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const SHOTS = process.env.SCREENSHOT_DIR;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };

let server;
let base;
let browser;

function serve(root) {
  return createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
}

// Fake Turnstile: renders implicitly like the real api.js and hands out a token after
// window.__tsDelay ms. Tests drive expiry/reset through window.__ts.
const FAKE_TURNSTILE = `
(() => {
  let n = 0, el = null, timer = null;
  const cb = (name, ...a) => { const fn = el && window[el.dataset[name]]; return fn && fn(...a); };
  function issue() {
    clearTimeout(timer);
    timer = setTimeout(() => cb("callback", "tok-" + (++n)), window.__tsDelay ?? 0);
  }
  window.__ts = { resets: 0, expire: () => cb("expiredCallback"), error: () => cb("errorCallback", 300010), issue };
  window.turnstile = { reset() { window.__ts.resets++; issue(); }, execute() {}, render() {} };
  el = document.querySelector(".cf-turnstile");
  if (el) issue();
})();`;

async function page({ delay, contactStatus = 200, contactBody = { success: true, message: "Mesajul a fost trimis! Vom reveni în 24h." } }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ro-RO" });
  await ctx.addInitScript(`window.__tsDelay = ${delay};`);
  // Playwright matches the most recently added route first: block everything off-box,
  // then answer Turnstile's api.js with the fake.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route("https://challenges.cloudflare.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }));
  const posts = [];
  await ctx.route("**/api/contact", async (r) => {
    posts.push(JSON.parse(r.request().postData() || "{}"));
    await r.fulfill({ status: contactStatus, contentType: "application/json", body: JSON.stringify(contactBody) });
  });
  const p = await ctx.newPage();
  await p.goto(`${base}/#contact`);
  return { p, ctx, posts };
}

async function fill(p) {
  await p.fill("#name", "Ana Test");
  await p.fill("#email", "ana@example.test");
  await p.fill("#message", "Salut");
}

const btnState = (p) => p.$eval("#submit-btn", (b) => ({ disabled: b.disabled, busy: b.getAttribute("aria-busy"), text: b.textContent.trim() }));

before(async () => {
  server = serve(DIST);
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: CHROME });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});

after(async () => {
  await browser?.close();
  server?.close();
});

test("button waits for the token, then enables", async () => {
  const { p, ctx } = await page({ delay: 10000 });
  assert.deepEqual(await btnState(p), { disabled: true, busy: "true", text: "Se verifică…" });
  if (SHOTS) await p.locator("#contact-form").screenshot({ path: join(SHOTS, "contact-verifying.png") });
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  assert.deepEqual(await btnState(p), { disabled: false, busy: "false", text: "Trimite mesajul" });
  if (SHOTS) await p.locator("#contact-form").screenshot({ path: join(SHOTS, "contact-ready.png") });
  await ctx.close();
});

test("fast submit before a token waits and sends once the token arrives (no error)", async () => {
  const { p, ctx, posts } = await page({ delay: 1200 });
  await fill(p);
  // Enter/implicit submission is blocked by the disabled button, so force a submit
  // the way a fast or scripted submit would arrive.
  await p.$eval("#contact-form", (f) => f.requestSubmit());
  await p.waitForTimeout(300);
  assert.equal(posts.length, 0, "nothing sent without a token");
  assert.equal(await p.$eval("#form-status", (s) => s.textContent), "", "no 'Verificare de securitate lipsă.' style error");
  await p.waitForFunction(() => document.getElementById("form-status").textContent.includes("Mesajul a fost trimis"));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].turnstileToken, "tok-1");
  assert.equal(posts[0].name, "Ana Test");
  await ctx.close();
});

test("after a send the widget resets and the button waits for a fresh token", async () => {
  const { p, ctx, posts } = await page({ delay: 400 });
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  await fill(p);
  await p.click("#submit-btn");
  await p.waitForFunction(() => document.getElementById("form-status").textContent.includes("Mesajul a fost trimis"));
  assert.equal(await p.evaluate(() => window.__ts.resets), 1);
  assert.equal(await p.inputValue("#name"), "", "form cleared");
  assert.equal((await btnState(p)).text, "Se verifică…");
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  await fill(p);
  await p.click("#submit-btn");
  await p.waitForFunction(() => document.querySelectorAll("#form-status").length && window.__ts.resets === 2);
  assert.deepEqual(posts.map((x) => x.turnstileToken), ["tok-1", "tok-2"], "each send uses a fresh token");
  if (SHOTS) await p.locator("#contact-form").screenshot({ path: join(SHOTS, "contact-sent.png") });
  await ctx.close();
});

test("server error still resets the single-use token", async () => {
  const { p, ctx } = await page({ delay: 0, contactStatus: 500, contactBody: { success: false, error: "Nu am putut trimite mesajul. Încearcă din nou." } });
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  await fill(p);
  await p.click("#submit-btn");
  await p.waitForFunction(() => document.getElementById("form-status").textContent.includes("Nu am putut trimite"));
  assert.equal(await p.evaluate(() => window.__ts.resets), 1);
  await ctx.close();
});

test("expiry disables the button until Turnstile refreshes; error clears on recovery", async () => {
  const { p, ctx } = await page({ delay: 0 });
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  await p.evaluate(() => window.__ts.expire());
  assert.deepEqual(await btnState(p), { disabled: true, busy: "true", text: "Se verifică…" });
  await p.evaluate(() => window.__ts.error());
  assert.match(await p.$eval("#form-status", (s) => s.textContent), /Verificarea de securitate nu a reușit încă/);
  await p.evaluate(() => window.__ts.issue());
  await p.waitForFunction(() => !document.getElementById("submit-btn").disabled);
  assert.equal(await p.$eval("#form-status", (s) => s.className), "hidden");
  await ctx.close();
});
