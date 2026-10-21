import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSENT_KEY, LANDING_KEY } from "../src/lib/meta/pixel.ts";
import { cookieDenied, withdrawConsent } from "../src/lib/consent-withdraw.ts";

test("Retrage acordul: tapselo_consent=denied on .tapselo.com, tapselo_attr deleted, landing dropped", () => {
  const cookies: string[] = [];
  const session = new Map([[LANDING_KEY, "/ghid"]]);
  withdrawConsent({ setCookie: (c) => cookies.push(c), session: { removeItem: (k) => void session.delete(k) } });
  assert.ok(cookies.some((c) => /^tapselo_consent=denied;.*Domain=\.tapselo\.com.*Max-Age=15552000/.test(c)));
  assert.ok(cookies.some((c) => /^tapselo_attr=;.*Domain=\.tapselo\.com.*Max-Age=0/.test(c)));
  assert.equal(session.has(LANDING_KEY), false);
});

test("blocked storage does not break withdrawal", () => {
  const bad = { removeItem: () => { throw new Error("blocked"); } };
  assert.equal(withdrawConsent({ setCookie: () => {}, session: bad }).length, 2);
});

test("denied cookie overrides a stored Accept", () => {
  assert.equal(cookieDenied("a=1; tapselo_consent=denied"), true);
  assert.equal(cookieDenied("tapselo_consent=marketing"), false);
});

test("button in footer and on /privacy#retrage-acordul; demo revokes fbq", () => {
  assert.match(readFileSync("src/components/Footer.astro", "utf8"), /<WithdrawConsent/);
  assert.match(readFileSync("src/pages/privacy.astro", "utf8"), /id="retrage-acordul"[\s\S]*<WithdrawConsent/);
  const c = readFileSync("src/components/WithdrawConsent.astro", "utf8");
  assert.match(c, /Retrage acordul/);
  assert.doesNotMatch(c, /[şţŞŢ]/);
  assert.match(readFileSync("src/components/MetaPixelDemo.astro", "utf8"), /fbq\?\.\("consent", "revoke"\)/);
});

test("every withdrawal stores the „Refuz” choice in localStorage (regression: #77 left 'granted')", () => {
  const local = new Map([[CONSENT_KEY, "granted"]]);
  withdrawConsent({ setCookie: () => {}, local: { setItem: (k, v) => void local.set(k, v) } });
  assert.equal(local.get(CONSENT_KEY), "denied");
});

/** JS a built page loads, following relative imports. */
function pageJs(dist: string, html: string): string {
  const seen = new Set<string>();
  const queue = [...html.matchAll(/src="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
  let out = "";
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f) || !existsSync(join(dist, f))) continue;
    seen.add(f);
    const js = readFileSync(join(dist, f), "utf8");
    out += js;
    for (const m of js.matchAll(/["']\.\/([^"']+\.js)["']/g)) queue.push(`/_astro/${m[1]}`);
  }
  return out;
}

test("default build (no pixel ID): withdrawal on a non-demo page and on /demo/ writes the denied choice", () => {
  const dist = join(process.cwd(), "dist");
  for (const page of ["index.html", "privacy/index.html", "demo/index.html"]) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /data-withdraw-consent-btn/, page);
    assert.doesNotMatch(html, /data-meta-consent/, `${page}: no pixel in this build`);
    const js = pageJs(dist, html);
    assert.match(js, /tapselo_marketing_consent/, `${page}: withdraw code must write the localStorage choice`);
    assert.match(js, /localStorage/, page);
  }
});
