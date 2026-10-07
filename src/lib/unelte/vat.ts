import { roundMoney } from "../generators/validate.ts";

/** Romanian VAT rates from 1 August 2025 (Legea 141/2025): 21% standard, 11% reduced. */
export const VAT_RATES_RO = [21, 11] as const;
export type VatRateRo = (typeof VAT_RATES_RO)[number];

export function isVatRateRo(n: unknown): n is VatRateRo {
  return (VAT_RATES_RO as readonly unknown[]).includes(n);
}

export type VatMode = "add" | "remove";

export interface VatCalcInput {
  amount: number;
  rate: VatRateRo;
  mode: VatMode;
}

export interface VatCalcResult {
  net: number;
  vat: number;
  gross: number;
  rate: VatRateRo;
}

/** amount is with VAT when mode=remove, without VAT when mode=add */
export function calculateVat(i: VatCalcInput): VatCalcResult {
  const amount = roundMoney(i.amount);
  if (!(amount >= 0)) throw new RangeError("Introdu o sumă validă (≥ 0).");
  const r = i.rate / 100;
  switch (i.mode) {
    case "add": {
      const vat = roundMoney(amount * r);
      return { net: amount, vat, gross: roundMoney(amount + vat), rate: i.rate };
    }
    case "remove": {
      const net = roundMoney(amount / (1 + r));
      return { net, vat: roundMoney(amount - net), gross: amount, rate: i.rate };
    }
    default: {
      const never: never = i.mode;
      throw new RangeError(`Mod TVA necunoscut: ${String(never)}`);
    }
  }
}
