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

const CUI_KEY = "753217532";

/** Standard CUI/CIF mod-11 port (same as company.ts / ANAF practice). */
function isValidCuiReferencePort(cui: string): boolean {
  if (!/^\d{2,10}$/.test(cui)) return false;
  const body = cui.slice(0, -1).padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(CUI_KEY[i]);
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return c === Number(cui[cui.length - 1]);
}

const NUI_WEIGHTS = [7, 8, 6, 2, 1, 3, 4, 5, 9] as const;

/**
 * Direct port of a4200validator.v0.MReg.checkNUI (A4200Validator.jar J1.0.5).
 * Variable names follow javap locals: val=lstore_2, rest=lstore_4, sum=lstore_6.
 */
function isValidNuiAnafJarPort(nui: string): boolean {
  if (nui.length !== 10) return false;
  let val: bigint;
  try {
    val = BigInt(nui);
  } catch {
    return false;
  }
  let sum = 0n;
  let rest = 0n;
  for (let i = 0; i < 9; i++) {
    rest = val % 10n;
    val /= 10n;
    if (rest >= 5n) val += 1n;
    sum += rest * BigInt(NUI_WEIGHTS[i]);
  }
  if (rest >= 5n) val -= 1n;
  const expected = BigInt(1 + Number(sum % 9n));
  return val === expected;
}

/** Pre-fix bug: decremented val % 10 instead of using last loop digit for the >= 5 test. */
function isValidNuiWrongPort(nui: string): boolean {
  if (nui.length !== 10) return false;
  let val = BigInt(nui);
  let sum = 0n;
  for (let i = 0; i < 9; i++) {
    const digit = val % 10n;
    val /= 10n;
    if (digit >= 5n) val += 1n;
    sum += digit * BigInt(NUI_WEIGHTS[i]);
  }
  let check = val % 10n;
  if (check >= 5n) check -= 1n;
  const expected = BigInt(1 + Number(sum % 9n));
  return check === expected;
}

function nineDigitPrefix(seed: number): string {
  const n = (seed * 1_000_003 + 42) % 1_000_000_000;
  return String(n).padStart(9, "0");
}

function validNuiForPrefix(prefix9: string): string | null {
  for (let d = 0; d <= 9; d++) {
    const candidate = `${prefix9}${d}`;
    if (isValidNuiAnafJarPort(candidate)) return candidate;
  }
  return null;
}

test("CUI check digit: known valid and invalid", () => {
  assert.equal(isValidCuiCheckDigit("14399840"), true);
  assert.equal(isValidCuiCheckDigit("1234567"), false);
});

test("CUI check digit matches reference mod-11 port on random values", () => {
  for (let i = 0; i < 50_000; i++) {
    const len = 2 + (i % 9);
    let s = "";
    for (let j = 0; j < len; j++) s += String((i * 17 + j * 3) % 10);
    if (s[0] === "0") s = "1" + s.slice(1);
    assert.equal(isValidCuiCheckDigit(s), isValidCuiReferencePort(s), s);
  }
});

test("NUI check digit: valid opis id prefix and anonymized fixture NUI", () => {
  assert.equal(isValidNuiCheckDigit("1234567890"), true);
  assert.equal(isValidNuiCheckDigit("9999999901"), false);
});

test("NUI: generated valid examples pass isValidNuiCheckDigit", () => {
  const found: string[] = [];
  for (let seed = 1; seed <= 200 && found.length < 8; seed++) {
    const prefix = nineDigitPrefix(seed);
    const nui = validNuiForPrefix(prefix);
    if (nui) found.push(nui);
  }
  assert.ok(found.length >= 5, "expected several constructible valid NUIs");
  for (const nui of found) {
    assert.equal(isValidNuiCheckDigit(nui), true, nui);
    assert.equal(isValidNuiAnafJarPort(nui), true, nui);
  }
});

test("NUI: isValidNuiCheckDigit matches ANAF jar port on 200k random 10-digit strings", () => {
  let jarDisagree = 0;
  let wrongDisagree = 0;
  for (let i = 0; i < 200_000; i++) {
    const nui = String(Math.floor(Math.random() * 10_000_000_000)).padStart(10, "0");
    if (isValidNuiCheckDigit(nui) !== isValidNuiAnafJarPort(nui)) jarDisagree++;
    if (isValidNuiWrongPort(nui) !== isValidNuiAnafJarPort(nui)) wrongDisagree++;
  }
  assert.equal(jarDisagree, 0);
  assert.ok(wrongDisagree > 15_000 && wrongDisagree < 25_000, `wrong port delta ${wrongDisagree}`);
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
