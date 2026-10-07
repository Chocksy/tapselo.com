import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampLabelCopies,
  CODE128_MAX_LENGTH,
  resolveCode128Input,
  resolveEan13Input,
  resolveEan8Input,
} from "../src/lib/unelte/barcode-generator.ts";
import { eanCheckDigit, isValidEan } from "../src/lib/ean13.ts";

test("EAN-13: auto check digit from 12 digits", () => {
  const r = resolveEan13Input("590123412345");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value, "5901234123457");
  assert.equal(r.checkDigitAdded, true);
  assert.equal(eanCheckDigit("590123412345"), 7);
});

test("EAN-13: validates full 13-digit code", () => {
  assert.equal(resolveEan13Input("5901234123457").ok, true);
  const bad = resolveEan13Input("5901234123458");
  assert.equal(bad.ok, false);
});

test("EAN-8: auto check digit and validation", () => {
  const r = resolveEan8Input("9638507");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value, "96385074");
  assert.ok(isValidEan("96385074"));
  assert.equal(resolveEan8Input("96385075").ok, false);
});

test("Code 128: length and ASCII limits", () => {
  assert.equal(resolveCode128Input("ABC-123").ok, true);
  assert.equal(resolveCode128Input("a".repeat(CODE128_MAX_LENGTH)).ok, true);
  const tooLong = resolveCode128Input("x".repeat(CODE128_MAX_LENGTH + 1));
  assert.equal(tooLong.ok, false);
  const badChar = resolveCode128Input("linie\nnouă");
  assert.equal(badChar.ok, false);
});

test("label copy count is clamped", () => {
  assert.equal(clampLabelCopies(0), 1);
  assert.equal(clampLabelCopies(999), 48);
  assert.equal(clampLabelCopies(12.7), 13);
});
