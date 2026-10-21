// Legal pages share the guide layout: 72rem .site-container, guide typography, „Pe pagină” TOC, footer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const page of ["privacy", "terms", "dpa", "data-deletion"]) {
  test(`/${page} uses GuideShell (shared container + TOC), not its own narrow column`, () => {
    const src = readFileSync(`src/pages/${page}.astro`, "utf8");
    assert.match(src, /<GuideShell[\s\S]*pageToc[\s\S]*adviceNote=\{false\}/);
    assert.doesNotMatch(src, /site-container site-reading/);
    assert.doesNotMatch(src, /<Layout\b/);
  });
}

test("/privacy keeps the #retrage-acordul anchor and button", () => {
  assert.match(readFileSync("src/pages/privacy.astro", "utf8"), /id="retrage-acordul"[\s\S]*<WithdrawConsent/);
});
