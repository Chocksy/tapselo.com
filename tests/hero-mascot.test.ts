import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("hero mascot island only hydrates on wide, mouse, motion-OK screens and takes no layout space", () => {
  const hero = read("src/components/Hero.astro");
  assert.match(hero, /<HeroMascot\s/);
  assert.match(hero, /client:media="\(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)"/);
  assert.match(hero, /class="pointer-events-none absolute [^"]*hidden md:block/);
});

test("hero mascot label is Romanian with no cedilla ş/ţ, static frame is decorative", () => {
  const src = read("src/components/HeroMascot.tsx");
  assert.match(src, /MASCOT_LABEL = "Mascota Tapselo: [^"]+"/);
  assert.doesNotMatch(src, /[şţŞŢ]/);
  assert.match(src, /aria-hidden="true"/);
});

test("mascot sprite sheets exist and stay small", () => {
  for (const sheet of ["directions", "reactions"]) {
    const p = join(root, `public/mascots/chef-${sheet}.webp`);
    assert.ok(existsSync(p), p);
    assert.ok(statSync(p).size < 100_000, `${sheet} sheet too large`);
  }
});

test("page-mascot MIT notice is kept", () => {
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert.match(notices, /page-mascot/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2026 Kamran Ahmed/);
});

test("built homepage renders the mascot island with a static frame and no React preload", () => {
  const html = read("dist/index.html");
  assert.match(html, /<astro-island[^>]*component-url="\/_astro\/HeroMascot[^"]*"[^>]*client="media"/);
  assert.match(html, /chef-directions\.webp/);
  assert.doesNotMatch(html, /<link rel="modulepreload"/);
});
