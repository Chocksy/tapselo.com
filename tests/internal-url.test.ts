import { test } from "node:test";
import assert from "node:assert/strict";
import { internalPath } from "../src/lib/internal-url.ts";

test("internalPath adds trailing slash to site paths", () => {
  assert.equal(internalPath("/ghid"), "/ghid/");
  assert.equal(internalPath("/unelte/calculator-tva"), "/unelte/calculator-tva/");
  assert.equal(internalPath("/ghid/articole/export-p7b-anaf"), "/ghid/articole/export-p7b-anaf/");
});

test("internalPath preserves root and hash links", () => {
  assert.equal(internalPath("/"), "/");
  assert.equal(internalPath("/#how-it-works"), "/#how-it-works");
  assert.equal(internalPath("/privacy#asistent-ai"), "/privacy/#asistent-ai");
});

test("internalPath leaves external URLs unchanged", () => {
  assert.equal(internalPath("https://app.tapselo.com"), "https://app.tapselo.com");
});
