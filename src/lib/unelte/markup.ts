// Markup math for /unelte/calculator-adaos-comercial, on top of calculateShelfPrice (MCP answer).

import { fmtMoney, formatDate } from "../generators/page.ts";
import { calculateShelfPrice, type Rounding } from "../mcp/answers/shelf-price.ts";
import { localIsoDate } from "./dates.ts";

/**
 * OUG nr. 67/2023 (amended by OUG nr. 22/2026, approved by Legea nr. 105/2026): retail markup on the
 * basic foods in its annex is at most 20%, until 31 December 2026 inclusive. Update or remove when it lapses.
 */
export const FOOD_MARKUP_CAP = 20;
export const FOOD_CAP_UNTIL = "2026-12-31";

export function foodCapActive(today = new Date()): boolean {
  return localIsoDate(today) <= FOOD_CAP_UNTIL;
}

export function foodMarkupWarning(markupPercent: number): string | null {
  if (markupPercent <= FOOD_MARKUP_CAP) return null;
  return `Adaosul de ${fmtMoney(markupPercent)}% depășește plafonul de ${FOOD_MARKUP_CAP}% pentru alimentele de bază din OUG nr. 67/2023 (aplicabil până la ${formatDate(FOOD_CAP_UNTIL)}). Verifică dacă produsul este pe listă și calculul cu contabilul.`;
}

/** Rounds bani down to the previous price ending (,x9 or ,49/,99); the mirror of roundPriceCents. */
export function roundPriceDownCents(cents: number, rounding: Rounding): number {
  switch (rounding) {
    case "none":
      return cents;
    case "0.09":
      return Math.floor((cents + 1) / 10) * 10 - 1;
    case "0.49_0.99":
      return Math.floor((cents + 1) / 50) * 50 - 1;
    default: {
      const never: never = rounding;
      throw new RangeError(`Rotunjire necunoscută: ${String(never)}`);
    }
  }
}

export interface FoodCapCheck {
  /** Real markup after rounding is above the cap. */
  over: boolean;
  /** Rounding (not the markup typed in) is what pushes it over. */
  roundingCaused: boolean;
  /** Highest shelf price with VAT that keeps the markup at or under the cap, with the same rounding. */
  maxLegalPrice: number;
  message: string | null;
}

export function foodCapCheck(cost: number, markupPercent: number, vatRate: number, rounding: Rounding): FoodCapCheck {
  const p = calculateShelfPrice({ cost, markup_percent: markupPercent, vat_rate: vatRate, rounding });
  const capCents = Math.floor(Number((cost * (1 + FOOD_MARKUP_CAP / 100) * (1 + vatRate / 100) * 100).toFixed(6)));
  const maxCents = roundPriceDownCents(capCents, rounding);
  const maxLegalPrice = Math.max(maxCents, 0) / 100;
  const over = p.markup_percent > FOOD_MARKUP_CAP;
  const roundingCaused = over && markupPercent <= FOOD_MARKUP_CAP;
  let message: string | null = null;
  const maxText = maxLegalPrice > 0 ? ` sau un preț de cel mult ${fmtMoney(maxLegalPrice)} lei` : "";
  if (roundingCaused) {
    message = `Rotunjirea ridică adaosul la ${fmtMoney(p.markup_percent)}%, peste plafonul de ${FOOD_MARKUP_CAP}%. Alege „Fără rotunjire”${maxText}.`;
  } else if (over) {
    message = `${foodMarkupWarning(p.markup_percent)}${maxLegalPrice > 0 ? ` Prețul maxim cu adaos de ${FOOD_MARKUP_CAP}%: ${fmtMoney(maxLegalPrice)} lei.` : ""}`;
  }
  return { over, roundingCaused, maxLegalPrice, message };
}

export interface MarkupFromPrice {
  /** Markup on cost, percent. */
  markup_percent: number;
  /** Margin on the sale price without VAT, percent. */
  margin_percent: number;
  /** Per unit, without VAT. */
  profit: number;
  price_without_vat: number;
}

/** Reverse mode: sale price with VAT and cost without VAT -> real markup and margin. */
export function markupFromPrice(cost: number, priceWithVat: number, vatRate: number): MarkupFromPrice {
  if (!(cost > 0)) throw new RangeError("Costul trebuie să fie mai mare ca 0.");
  if (!(priceWithVat > 0)) throw new RangeError("Prețul de vânzare trebuie să fie mai mare ca 0.");
  const net = priceWithVat / (1 + vatRate / 100);
  const profit = net - cost;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    markup_percent: r2((profit / cost) * 100),
    margin_percent: r2((profit / net) * 100),
    profit: r2(profit),
    price_without_vat: r2(net),
  };
}
