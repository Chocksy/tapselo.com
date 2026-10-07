import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isValidCuiCheckDigit, isValidNuiCheckDigit } from "../src/lib/fiscal/check-digit.ts";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { buildCrossCheckInput, runLocalChecks } from "../src/lib/a4200/pipeline.ts";
import { buildOpisCheckSummary } from "../src/lib/a4200/check-summary.ts";
import { buildVerificationPlainSummary } from "../src/lib/a4200/wizard.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

test("CUI check digit: known valid and invalid", () => {
  assert.equal(isValidCuiCheckDigit("14399840"), true);
  assert.equal(isValidCuiCheckDigit("1234567"), false);
});

test("NUI check digit: valid opis id prefix and anonymized fixture NUI", () => {
  assert.equal(isValidNuiCheckDigit("1234567890"), true);
  assert.equal(isValidNuiCheckDigit("9999999901"), false);
});

test("good fixtures pass identifier checks", () => {
  const files = ingestBuffers(
    ["opis-good.xml", "day-z001.xml", "day-z002.xml"].map((name) => ({
      name,
      data: new Uint8Array(fs.readFileSync(path.join(FIX, name))),
    })),
  ).files;
  const issues = runLocalChecks(files);
  assert.ok(!issues.some((i) => i.code === "CUI_CHECK_DIGIT" || i.code === "NUI_CHECK_DIGIT"));
});

test("anonymized Datecs set fails CUI and NUI check digits with plain Romanian headline", () => {
  const dir = path.join(FIX, "datecs-anon");
  const entries = fs.readdirSync(dir).map((name) => ({
    name,
    data: new Uint8Array(fs.readFileSync(path.join(dir, name))),
  }));
  const { files } = ingestBuffers(entries);
  const issues = runLocalChecks(files);
  assert.ok(issues.some((i) => i.code === "CUI_CHECK_DIGIT"));
  assert.ok(issues.some((i) => i.code === "NUI_CHECK_DIGIT"));
  const { input } = buildCrossCheckInput(files);
  const summary = buildOpisCheckSummary(input);
  const plain = buildVerificationPlainSummary(summary, issues, input.days);
  assert.equal(plain.ok, false);
  assert.match(plain.headline, /CUI|NUI|codul fiscal|numărul casei/i);
  assert.doesNotMatch(plain.headline, /Totul arată în regulă/);
});
