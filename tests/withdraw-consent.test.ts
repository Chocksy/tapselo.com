import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANDING_KEY } from "../src/lib/meta/pixel.ts";
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
