import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCuiFromText } from "../extensions/verificare-cui/lib/extract-cui.mjs";
import { isValidCuiCheckDigit } from "../extensions/verificare-cui/lib/normalize.mjs";

const CUI_KEY = "753217532";

/** Synthetic CUI with valid check digit (not tied to a real company). */
function fakeValidCui(bodyDigits: string): string {
  const body = bodyDigits.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(CUI_KEY[i]);
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return `${body.replace(/^0+/, "") || "0"}${c}`.replace(/^(\d+?)(\d)$/, (_, b, d) => {
    const trimmed = b.replace(/^0+/, "") || "0";
    return `${trimmed}${d}`;
  });
}

test("extractCuiFromText finds CUI in prose (fake checksum)", () => {
  const cui = fakeValidCui("1234567");
  assert.ok(isValidCuiCheckDigit(cui));
  assert.equal(extractCuiFromText(`Factură către RO ${cui} trimisă`), cui);
  assert.equal(extractCuiFromText(cui), cui);
  assert.equal(extractCuiFromText("fără cod fiscal aici"), null);
  assert.equal(extractCuiFromText("RO9999999999"), null);
});
