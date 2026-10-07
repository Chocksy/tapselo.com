import { roundMoney } from "../generators/validate.ts";

export const VAT_RATES_RO = [21, 11, 0] as const;
export type VatRateRo = (typeof VAT_RATES_RO)[number];

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
  if (i.mode === "add") {
    const net = amount;
    const vat = roundMoney(net * r);
    const gross = roundMoney(net + vat);
    return { net, vat, gross, rate: i.rate };
  }
  const gross = amount;
  const net = r === 0 ? gross : roundMoney(gross / (1 + r));
  const vat = roundMoney(gross - net);
  return { net, vat, gross, rate: i.rate };
}
