import { roundMoney } from "../generators/validate.ts";

export type DiscountMode = "after_percent" | "final_and_savings" | "percent_between" | "stacked";

export interface AfterPercentResult {
  original: number;
  percentOff: number;
  final: number;
  saved: number;
}

export interface PercentBetweenResult {
  original: number;
  sale: number;
  percentOff: number;
  saved: number;
}

export interface StackedDiscountResult {
  original: number;
  percents: number[];
  final: number;
  saved: number;
  /** Total reduction vs initial price, in percent (0–100). */
  effectivePercent: number;
}

function assertNonNegativePrice(n: number, label: string): void {
  const v = roundMoney(n);
  if (!(v >= 0)) throw new RangeError(`${label} trebuie să fie ≥ 0.`);
}

export function assertDiscountPercent(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new RangeError("Reducerea trebuie să fie între 0% și 100%.");
  }
}

/** preț nou = preț inițial × (1 − reducere%/100); economii = inițial − nou. */
export function priceAfterPercent(original: number, percentOff: number): AfterPercentResult {
  assertNonNegativePrice(original, "Prețul");
  assertDiscountPercent(percentOff);
  const orig = roundMoney(original);
  const final = roundMoney(orig * (1 - percentOff / 100));
  const saved = roundMoney(orig - final);
  return { original: orig, percentOff: roundMoney(percentOff), final, saved };
}

/** Reducere % = (preț vechi − preț nou) / preț vechi × 100. */
export function percentBetweenPrices(original: number, sale: number): PercentBetweenResult {
  assertNonNegativePrice(original, "Prețul inițial");
  assertNonNegativePrice(sale, "Prețul redus");
  const orig = roundMoney(original);
  const saleR = roundMoney(sale);
  if (saleR > orig) throw new RangeError("Prețul redus nu poate fi mai mare decât prețul inițial.");
  if (orig === 0) {
    return { original: 0, sale: saleR, percentOff: 0, saved: 0 };
  }
  const saved = roundMoney(orig - saleR);
  const percentOff = roundMoney((saved / orig) * 100);
  return { original: orig, sale: saleR, percentOff, saved };
}

/**
 * Reduceri aplicate succesiv pe prețul rămas (ex. −20% apoi −10% pe noul preț).
 * Reducere efectivă % = 100 × (1 − ∏(1 − pᵢ/100)).
 */
export function stackedDiscount(original: number, percents: number[]): StackedDiscountResult {
  assertNonNegativePrice(original, "Prețul inițial");
  if (percents.length === 0) throw new RangeError("Adaugă cel puțin o reducere procentuală.");
  const orig = roundMoney(original);
  let factor = 1;
  for (const p of percents) {
    assertDiscountPercent(p);
    factor *= 1 - p / 100;
  }
  const final = roundMoney(orig * factor);
  const saved = roundMoney(orig - final);
  const effectivePercent = orig === 0 ? 0 : roundMoney((saved / orig) * 100);
  return {
    original: orig,
    percents: percents.map((p) => roundMoney(p)),
    final,
    saved,
    effectivePercent,
  };
}
