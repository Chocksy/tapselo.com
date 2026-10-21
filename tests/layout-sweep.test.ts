// Layout regression across every built route: content aligns with the header's 72rem container,
// heading scale h1 > h2 > h3, prose paragraphs/lists are spaced, and no page combines
// .site-container with .site-reading on one element (the narrow-column bug from #80).
// Browser part runs when Chrome is available (CHROME_PATH or /usr/bin/google-chrome); skipped otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const DIST = join(process.cwd(), "dist");
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
// Own layouts by design (only the sideways-scroll check applies): centred 404, customer card / recovery / email-confirmation pages, /demo/ video landing.
const OWN_SHELL = new Set(["/404.html", "/c/", "/p/", "/r/", "/confirmare/", "/dezabonare/", "/demo/"]);

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? htmlFiles(p) : n.endsWith(".html") ? [p] : [];
  });
}

test("no element combines site-container with site-reading", () => {
  for (const f of htmlFiles(DIST)) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /class="[^"]*\bsite-container\b[^"]*\bsite-reading\b|class="[^"]*\bsite-reading\b[^"]*\bsite-container\b/, relative(DIST, f));
  }
});

const AUDIT = `(() => {
  const nav = document.querySelector("nav .site-container");
  const main0 = document.querySelector("main") ?? document.body, h10 = document.querySelector("h1");
  if (!nav || !main0 || !h10) return { scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, missing: [!nav && "nav", !main0 && "main", !h10 && "h1"].filter(Boolean).join(",") };
  const ns = getComputedStyle(nav), nb = nav.getBoundingClientRect();
  const left = nb.left + parseFloat(ns.paddingLeft), right = nb.right - parseFloat(ns.paddingRight);
  const main = main0;
  const fs = (e) => parseFloat(getComputedStyle(e).fontSize);
  const vis = (sel) => [...main.querySelectorAll(sel)].filter((e) => e.offsetParent && !e.closest("aside"));
  const h1 = document.querySelector("h1");
  let cr = 0;
  for (const e of vis("h2,p,ul,ol,table,section,aside")) cr = Math.max(cr, e.getBoundingClientRect().right);
  for (const e of main.querySelectorAll("aside")) if (e.offsetParent) cr = Math.max(cr, e.getBoundingClientRect().right);
  let tight = 0;
  // Prose only (guide/legal/tool article bodies); UI mockups on the homepage are not prose.
  for (const e of vis(".kb-prose p, .kb-prose ul, .kb-prose ol, .prose-tapselo p, .prose-tapselo ul, .prose-tapselo ol, .guide-page-content p, .guide-page-content ul, .guide-page-content ol")) {
    const n = e.nextElementSibling;
    if (n && /^(P|UL|OL)$/.test(n.tagName) && n.offsetParent && n.getBoundingClientRect().top - e.getBoundingClientRect().bottom < 4) tight++;
  }
  const scrollWidth = document.documentElement.scrollWidth;
  return { scrollWidth, viewport: innerWidth, left, right, h1Left: h1.getBoundingClientRect().left, h1: fs(h1),
    h2: Math.max(0, ...vis("h2").map(fs)), h3: Math.max(0, ...vis("h3").map(fs)), contentRight: cr, tight };
})()`;

test("every route: no sideways page scroll; aligned with the header container, h1 > h2 > h3, spaced prose", { timeout: 300_000, skip: !existsSync(CHROME) && "no Chrome" }, async () => {
  const { chromium } = await import("playwright-core");
  const routes = htmlFiles(DIST).map((f) => "/" + relative(DIST, f).replace(/index\.html$/, ""));
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  const server = createServer((req, res) => {
    let p = join(DIST, decodeURIComponent((req.url ?? "/").split("?")[0]));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!existsSync(p)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" }).end(readFileSync(p));
  }).listen(0);
  const port = (server.address() as { port: number }).port;
  // Block third-party requests (analytics, Turnstile, fonts CDN) so the test is offline and quiet.
  const browser = await chromium.launch({ executablePath: CHROME });
  const problems: string[] = [];
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      for (const route of routes) {
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load" });
        const d = await page.evaluate(AUDIT);
        const at = `${width} ${route}`;
        // Sideways page scroll (internal scroll containers like the /comparatie table are fine). Checked on
        // every route, own-layout pages included.
        if (d.scrollWidth > d.viewport) problems.push(`${at}: page is ${d.scrollWidth}px wide (viewport ${d.viewport}px)`);
        if (OWN_SHELL.has(route)) continue;
        if (d.missing) { problems.push(`${at}: missing ${d.missing}`); continue; }
        if (Math.abs(d.h1Left - d.left) > 2) problems.push(`${at}: h1 left ${d.h1Left} vs header ${d.left}`);
        if (d.h2 && d.h2 >= d.h1) problems.push(`${at}: h2 ${d.h2}px >= h1 ${d.h1}px`);
        if (d.h3 && d.h2 && d.h3 >= d.h2) problems.push(`${at}: h3 ${d.h3}px >= h2 ${d.h2}px`);
        if (d.tight) problems.push(`${at}: ${d.tight} unspaced paragraph/list pairs`);
        if (width === 1280 && d.contentRight && d.right - d.contentRight > 40) problems.push(`${at}: content ends ${Math.round(d.right - d.contentRight)}px before the header container`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  assert.deepEqual(problems, []);
});
