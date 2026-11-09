import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_MASCOT, MASCOTS, MASCOT_HIDDEN_KEY, REACTIONS, cell, mascotHtml } from "../src/data/mascot.ts";

// J2 "Host": Nea Tapselo lives at fixed spots, one reaction each. No corner mascot that follows the cursor.
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const dist = resolve(root, process.env.TAPSELO_DIST ?? "dist");

test("layout: no corner mascot, the mascot prop turns the spots on, hidden state read before paint", () => {
  const layout = read("src/layouts/Layout.astro");
  assert.doesNotMatch(layout, /SiteMascot|MascotIsland/);
  assert.match(layout, /data-mascot=\{mascot \|\| undefined\}/);
  assert.match(layout, /sessionStorage\.getItem\(/);
  assert.match(layout, /ms-off/);
  assert.match(read("src/components/PublicShell.astro"), /mascot=\{false\}/);
  assert.equal(MASCOT_HIDDEN_KEY, "tapselo:mascot-hidden");
});

test("sprite cells: 3x3 reactions sheet, the 9 poses the other scripts may ask for", () => {
  assert.deepEqual(Object.keys(REACTIONS).sort(), ["bliss", "dizzy", "heart", "laugh", "sleepy", "smile", "sparkles", "star", "surprised"]);
  assert.equal(cell(REACTIONS.heart), "50% 0%");
  assert.equal(cell(REACTIONS.laugh), "100% 100%");
  const html = mascotHtml({ spot: "calc", pose: "sparkles", rest: "left", size: 96, sizeSm: 72 });
  assert.match(html, /data-spot="calc"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /--s:96px;--sm:72px/);
  assert.match(html, /shopkeeper-directions\.webp/);
  assert.match(html, /shopkeeper-reactions\.webp/);
});

test("script: ts:mascot event, per-visit hide in sessionStorage, nothing moves with reduced motion", () => {
  const js = read("src/scripts/mascot.ts");
  assert.match(js, /addEventListener\("ts:mascot"/);
  assert.match(js, /sessionStorage\.setItem\(MASCOT_HIDDEN_KEY, "1"\)/);
  assert.match(js, /sessionStorage\.removeItem\(MASCOT_HIDDEN_KEY\)/);
  assert.doesNotMatch(js, /localStorage/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /"Ascunde mascota"/);
  assert.match(js, /"Arată mascota"/);
  const css = read("src/components/Mascot.astro");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html:not\(\[data-mascot\]\)/);
  assert.doesNotMatch(css, /position: fixed/);
});

test("every page with him has the 'Ascunde mascota' button (footer)", () => {
  const footer = read("src/components/Footer.astro");
  assert.match(footer, /data-ms-hide/);
  assert.match(footer, /<span>Ascunde mascota<\/span>/);
});

test("spots: one reaction each, at a fixed place in the page", () => {
  const spots: [string, RegExp][] = [
    ["src/components/home/HomeHero.astro", /spot="hero" pose="heart"/],
    ["src/components/home/Pricing.astro", /spot="pricing" pose="star"/],
    ["src/components/GuidePageToc.astro", /spot="handoff" pose="bliss"[^/]*still/],
    ["src/components/ResourceNav.astro", /spot="read"/],
    ["src/components/ResourceNav.astro", /spot: "search", pose: "surprised"/],
    ["src/components/unelte/DiscountCalculatorTool.astro", /spot="calc" pose="sparkles"/],
    ["src/pages/404.astro", /spot="404" pose="dizzy"/],
    ["src/components/Footer.astro", /spot="footer" pose="smile" rest="sleepy"/],
    ["src/components/admin/AdminHero.astro", /spot="admin"/],
    ["src/components/phone/PhoneDemo.astro", /spot="phone" pose="laugh"/],
  ];
  for (const [f, re] of spots) assert.match(read(f), re, f);
  assert.match(read("src/components/GuideShell.astro"), /<ResourceNav read=\{pageToc\} \/>/);
});

test("404: no offset for the old fixed bar, receipt shakes once, he wobbles once", () => {
  const p = read("src/pages/404.astro");
  assert.doesNotMatch(p, /pt-28/);
  assert.match(p, /BON ANULAT/);
  assert.match(p, /animation: nf-shake \.36s/);
  assert.match(p, /animation: nf-wob \.7s/);
});

test("both sheets exist, small files, Romanian label without cedillas", () => {
  for (const c of Object.values(MASCOTS)) {
    for (const p of [c.directions, c.reactions]) {
      const f = join(root, "public", p);
      assert.ok(existsSync(f), f);
      assert.ok(statSync(f).size < 100_000, `${p} too large`);
    }
    assert.match(c.label, /^Mascota Tapselo: /);
    assert.doesNotMatch(c.label, /[şţŞŢ]/);
  }
  assert.ok(Object.values(MASCOTS).includes(ACTIVE_MASCOT));
});

test("page-mascot MIT notice is kept", () => {
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert.match(notices, /page-mascot/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2026 Kamran Ahmed/);
});

test("built pages: spots on marketing pages, none on shopper pages, script under 3.5 KB gzip", { skip: !existsSync(join(dist, "index.html")) }, () => {
  const home = readFileSync(join(dist, "index.html"), "utf8");
  assert.match(home, /<html lang="ro" data-mascot/);
  assert.match(home, /data-spot="hero"/);
  assert.match(home, /data-spot="footer"/);
  assert.doesNotMatch(home, /id="site-mascot"|astro-island[^>]*MascotIsland/);
  const shop = readFileSync(join(dist, "p/index.html"), "utf8");
  assert.doesNotMatch(shop, /data-mascot|data-spot=/);
  // the component script plus the small data chunk it imports (cells, hidden key)
  const js = readdirSync(join(dist, "_astro")).filter((f) => /^(Mascot\.astro_.*|mascot\.[\w-]+)\.js$/.test(f));
  assert.equal(js.length, 2, js.join());
  const gz = js.reduce((n, f) => n + gzipSync(readFileSync(join(dist, "_astro", f)), { level: 9 }).length, 0);
  assert.ok(gz < 3584, // cursor follow + click reactions took it past 3 KB (the old page-mascot island was far bigger)
    `mascot script is ${gz} B gzip`);
});
