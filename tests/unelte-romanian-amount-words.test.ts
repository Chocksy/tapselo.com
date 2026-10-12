import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInRomanianWords, integerInRomanianWords } from "../src/lib/unelte/romanian-amount-words.ts";

test("integerInRomanianWords: common values", () => {
  assert.equal(integerInRomanianWords(0), "zero");
  assert.equal(integerInRomanianWords(1), "una");
  assert.equal(integerInRomanianWords(21), "douăzeci și una");
  assert.equal(integerInRomanianWords(100), "o sută");
  assert.equal(integerInRomanianWords(1500), "o mie cinci sute");
});

test("amountInRomanianWords: lei and bani", () => {
  assert.equal(amountInRomanianWords(1), "un leu");
  assert.equal(amountInRomanianWords(2), "două lei");
  assert.equal(amountInRomanianWords(0.5), "cincizeci bani");
  assert.equal(amountInRomanianWords(1234.56), "o mie două sute treizeci și patru lei și cincizeci și șase bani");
  assert.equal(amountInRomanianWords(100), "o sută lei");
});

test("amountInRomanianWords rejects invalid input", () => {
  assert.throws(() => amountInRomanianWords(-1), RangeError);
  assert.throws(() => amountInRomanianWords(Number.NaN), RangeError);
});
