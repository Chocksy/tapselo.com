import assert from "node:assert/strict";
import { test } from "node:test";
import {
  percentBetweenPrices,
  priceAfterPercent,
  stackedDiscount,
} from "../src/lib/unelte/discount.ts";

test("priceAfterPercent: 20% off 250 lei", () => {
  const r = priceAfterPercent(250, 20);
  assert.equal(r.original, 250);
  assert.equal(r.saved, 50);
  assert.equal(r.final, 200);
});

test("priceAfterPercent: rounds to bani", () => {
  const r = priceAfterPercent(89.9, 30);
  assert.equal(r.saved, 26.97);
  assert.equal(r.final, 62.93);
  assert.equal(r.final + r.saved, r.original);
});

test("percentBetweenPrices: 199.99 to 149.99", () => {
  const r = percentBetweenPrices(199.99, 149.99);
  assert.equal(r.saved, 50);
  assert.equal(r.percentOff, 25);
});

test("percentBetweenPrices: rejects sale above original", () => {
  assert.throws(() => percentBetweenPrices(100, 101), RangeError);
});

test("stackedDiscount: 20% then 10% on 100 = 72 lei, 28% effective", () => {
  const r = stackedDiscount(100, [20, 10]);
  assert.equal(r.final, 72);
  assert.equal(r.saved, 28);
  assert.equal(r.effectivePercent, 28);
});

test("stackedDiscount: single step matches simple discount", () => {
  const simple = priceAfterPercent(100, 15);
  const stacked = stackedDiscount(100, [15]);
  assert.equal(stacked.final, simple.final);
  assert.equal(stacked.effectivePercent, 15);
});

test("stackedDiscount: requires at least one percent", () => {
  assert.throws(() => stackedDiscount(50, []), RangeError);
});

test("discount percent bounds", () => {
  assert.throws(() => priceAfterPercent(10, -1), RangeError);
  assert.throws(() => priceAfterPercent(10, 101), RangeError);
});
