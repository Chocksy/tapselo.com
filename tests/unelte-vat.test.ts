import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateVat } from "../src/lib/unelte/vat.ts";

test("calculateVat: add 21%", () => {
  const r = calculateVat({ amount: 100, rate: 21, mode: "add" });
  assert.equal(r.net, 100);
  assert.equal(r.vat, 21);
  assert.equal(r.gross, 121);
});

test("calculateVat: remove 21% from gross", () => {
  const r = calculateVat({ amount: 121, rate: 21, mode: "remove" });
  assert.equal(r.gross, 121);
  assert.equal(r.net, 100);
  assert.equal(r.vat, 21);
});

test("calculateVat: 11% reduced rate", () => {
  const r = calculateVat({ amount: 50, rate: 11, mode: "add" });
  assert.equal(r.vat, 5.5);
  assert.equal(r.gross, 55.5);
});
