import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_MASCOT, MASCOTS } from "../src/data/mascot.ts";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("corner mascot: fixed, desktop-with-mouse only, hydrates only when motion is OK", () => {
  const src = read("src/components/SiteMascot.astro");
  assert.match(src, /client:media="\(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)"/);
  assert.match(src, /position: fixed;/);
  assert.match(src, /env\(safe-area-inset-bottom\)/);
  assert.match(src, /z-index: 30;/);
  assert.match(src, /\.site-mascot \{\n    display: none;/);
  assert.match(src, /@media \(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\) \{\n    \.site-mascot \{ display: block; \}/);
});

test("corner mascot has a remembered 'Ascunde mascota' button", () => {
  const src = read("src/components/SiteMascot.astro");
  assert.match(src, /aria-label="Ascunde mascota"/);
  assert.match(src, /localStorage\.setItem\(key, "1"\)/);
  assert.match(src, /localStorage\.getItem\(key\) === "1"/);
});

test("mascot is on marketing pages, not in the hero, not on shopper pages", () => {
  assert.doesNotMatch(read("src/components/Hero.astro"), /Mascot/);
  assert.match(read("src/layouts/Layout.astro"), /\{mascot && <SiteMascot \/>\}/);
  assert.match(read("src/components/PublicShell.astro"), /mascot=\{false\}/);
});

test("every character has both sheets, small files and a Romanian label without cedillas", () => {
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
  assert.match(read("src/components/MascotIsland.tsx"), /aria-hidden="true"/);
});

test("page-mascot MIT notice is kept", () => {
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert.match(notices, /page-mascot/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2026 Kamran Ahmed/);
});

test("mascot island renders with Preact compat, not React", () => {
  const pkg = JSON.parse(read("package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(deps["@astrojs/preact"] && deps.preact && deps["page-mascot"]);
  assert.equal(deps["@astrojs/react"], undefined);
  assert.equal(deps.react, undefined);
  assert.match(read("astro.config.mjs"), /preact\(\{ compat: true \}\)/);
});

test("built pages: homepage and a guide carry the corner mascot, shopper pages don't", () => {
  const home = read("dist/index.html");
  assert.match(home, /id="site-mascot"/);
  assert.match(home, /<astro-island[^>]*component-url="\/_astro\/MascotIsland[^"]*"[^>]*client="media"/);
  assert.match(home, new RegExp(ACTIVE_MASCOT.directions.replace(/[.]/g, "\\.")));
  assert.doesNotMatch(home, /<link rel="modulepreload"/);
  assert.match(read("dist/comparatie/index.html"), /id="site-mascot"/);
});
