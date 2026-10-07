import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOOD_MARKUP_CAP,
  foodCapActive,
  foodCapCheck,
  foodMarkupWarning,
  markupFromPrice,
  roundPriceDownCents,
} from "../src/lib/unelte/markup.ts";

test("food cap: 20% under OUG 67/2023, until 31.12.2026", () => {
  assert.equal(FOOD_MARKUP_CAP, 20);
  assert.equal(foodMarkupWarning(20), null);
  assert.match(foodMarkupWarning(20.01)!, /depășește plafonul de 20% pentru alimentele de bază din OUG nr\. 67\/2023 \(aplicabil până la 31\.12\.2026\)/);
  assert.doesNotMatch(foodMarkupWarning(350)!, /300/);
  assert.equal(foodCapActive(new Date(2026, 11, 31, 23, 30)), true);
  assert.equal(foodCapActive(new Date(2027, 0, 1, 0, 30)), false);
});

test("foodCapCheck: rounding to ,99 pushes 20% bread over the cap", () => {
  const c = foodCapCheck(2, 20, 11, "0.49_0.99");
  assert.equal(c.over, true);
  assert.equal(c.roundingCaused, true);
  assert.equal(c.maxLegalPrice, 2.49);
  assert.equal(c.message, "Rotunjirea ridică adaosul la 34,68%, peste plafonul de 20%. Alege „Fără rotunjire” sau un preț de cel mult 2,49 lei.");
});

test("foodCapCheck: within the cap without rounding, over the cap when typed", () => {
  const okCheck = foodCapCheck(2, 20, 11, "none");
  assert.deepEqual(okCheck, { over: false, roundingCaused: false, maxLegalPrice: 2.66, message: null });
  const over = foodCapCheck(2, 30, 11, "none");
  assert.equal(over.over, true);
  assert.equal(over.roundingCaused, false);
  assert.match(over.message!, /Prețul maxim cu adaos de 20%: 2,66 lei\.$/);
});

test("roundPriceDownCents mirrors the shelf endings", () => {
  assert.equal(roundPriceDownCents(266, "none"), 266);
  assert.equal(roundPriceDownCents(266, "0.09"), 259);
  assert.equal(roundPriceDownCents(269, "0.09"), 269);
  assert.equal(roundPriceDownCents(266, "0.49_0.99"), 249);
  assert.equal(roundPriceDownCents(249, "0.49_0.99"), 249);
  assert.equal(roundPriceDownCents(240, "0.49_0.99"), 199);
});

test("markupFromPrice: shelf price back to markup and margin", () => {
  assert.deepEqual(markupFromPrice(10, 14.43, 11), { markup_percent: 30, margin_percent: 23.08, profit: 3, price_without_vat: 13 });
  assert.deepEqual(markupFromPrice(10, 12.1, 21), { markup_percent: 0, margin_percent: 0, profit: 0, price_without_vat: 10 });
  assert.equal(markupFromPrice(10, 11, 21).markup_percent < 0, true);
  assert.throws(() => markupFromPrice(0, 10, 21), RangeError);
  assert.throws(() => markupFromPrice(10, 0, 21), RangeError);
});
