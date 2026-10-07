import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateVat, isVatRateRo, VAT_RATES_RO } from "../src/lib/unelte/vat.ts";

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

test("calculateVat: remove 21% from 100 lei (FAQ example)", () => {
  const r = calculateVat({ amount: 100, rate: 21, mode: "remove" });
  assert.equal(r.net, 82.64);
  assert.equal(r.vat, 17.36);
});

test("calculateVat: 11% reduced rate, add and remove", () => {
  const add = calculateVat({ amount: 50, rate: 11, mode: "add" });
  assert.equal(add.vat, 5.5);
  assert.equal(add.gross, 55.5);
  const rem = calculateVat({ amount: 100, rate: 11, mode: "remove" });
  assert.equal(rem.net, 90.09);
  assert.equal(rem.vat, 9.91);
  assert.equal(rem.net + rem.vat, 100);
});

test("calculateVat: rounding edges keep net + VAT = gross", () => {
  for (const amount of [0, 0.01, 0.05, 1.11, 9.99, 1234.5, 999999.99]) {
    for (const rate of VAT_RATES_RO) {
      const r = calculateVat({ amount, rate, mode: "remove" });
      assert.equal(Math.round((r.net + r.vat) * 100), Math.round(amount * 100), `${amount} @ ${rate}`);
    }
  }
  assert.equal(calculateVat({ amount: 0.01, rate: 21, mode: "remove" }).vat, 0);
  assert.throws(() => calculateVat({ amount: -1, rate: 21, mode: "add" }), RangeError);
});

test("only the rates in force from 1 August 2025 are offered", () => {
  assert.deepEqual([...VAT_RATES_RO], [21, 11]);
  for (const old of [0, 5, 9, 19]) assert.equal(isVatRateRo(old), false, String(old));
  assert.equal(isVatRateRo("21"), false);
});
