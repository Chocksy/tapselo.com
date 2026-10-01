// calculate_shelf_price: cost without VAT -> shelf price with VAT. Pure math, all in bani (cents).

import type { ToolDef } from "../types.ts";
import { formatLei, formatPercent } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";

const NAME = "calculate_shelf_price";

export type Rounding = "none" | "0.09" | "0.49_0.99";
export type Unit = "kg" | "g" | "l" | "ml";

export interface ShelfPriceInput {
  cost: number;
  vat_rate: number;
  markup_percent?: number;
  target_margin_percent?: number;
  rounding?: Rounding;
  unit_quantity?: number;
  unit?: Unit;
}

export interface ShelfPrice {
  cost: number;
  vat_rate: number;
  price_before_rounding: number;
  price_with_vat: number;
  price_without_vat: number;
  vat_amount: number;
  profit: number;
  markup_percent: number;
  margin_percent: number;
  rounding: Rounding;
  unit_price: number | null;
  unit_price_label: string | null;
}

/** Rounds bani up to the next price ending: ,x9 for "0.09"; ,49 or ,99 for "0.49_0.99". Never lowers the price. */
export function roundPriceCents(cents: number, rounding: Rounding): number {
  if (rounding === "0.09") return Math.ceil((cents + 1) / 10) * 10 - 1;
  if (rounding === "0.49_0.99") return Math.ceil((cents + 1) / 50) * 50 - 1;
  return cents;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateShelfPrice(i: ShelfPriceInput): ShelfPrice {
  const hasMarkup = typeof i.markup_percent === "number";
  const hasMargin = typeof i.target_margin_percent === "number";
  if (hasMarkup === hasMargin) throw new RangeError("Trimite fie adaosul (markup_percent), fie marja dorita (target_margin_percent), nu pe amandoua.");
  if (!(i.cost > 0)) throw new RangeError("Costul trebuie sa fie mai mare ca 0.");
  if (hasMargin && !((i.target_margin_percent as number) >= 0 && (i.target_margin_percent as number) < 100))
    throw new RangeError("Marja trebuie sa fie intre 0 si 99,99%.");
  const rounding = i.rounding ?? "none";

  const net = hasMarkup ? i.cost * (1 + (i.markup_percent as number) / 100) : i.cost / (1 - (i.target_margin_percent as number) / 100);
  // Round half up on the exact value in bani (avoid 14.43 * 100 = 1442.9999...).
  const rawCents = Math.round(Number((net * (1 + i.vat_rate / 100) * 100).toFixed(6)));
  const finalCents = roundPriceCents(rawCents, rounding);
  const gross = finalCents / 100;
  const netFinal = gross / (1 + i.vat_rate / 100);
  const profit = netFinal - i.cost;

  let unitPrice: number | null = null;
  let unitLabel: string | null = null;
  if (i.unit && typeof i.unit_quantity === "number" && i.unit_quantity > 0) {
    const base = i.unit === "g" || i.unit === "kg" ? "kg" : "l";
    const qty = i.unit === "g" || i.unit === "ml" ? i.unit_quantity / 1000 : i.unit_quantity;
    unitPrice = r2(gross / qty);
    unitLabel = `${formatLei(unitPrice)}/${base}`;
  }

  return {
    cost: i.cost,
    vat_rate: i.vat_rate,
    price_before_rounding: rawCents / 100,
    price_with_vat: gross,
    price_without_vat: r2(netFinal),
    vat_amount: r2(gross - netFinal),
    profit: r2(profit),
    markup_percent: r2((profit / i.cost) * 100),
    margin_percent: netFinal > 0 ? r2((profit / netFinal) * 100) : 0,
    rounding,
    unit_price: unitPrice,
    unit_price_label: unitLabel,
  };
}

export function createShelfPriceTool(): ToolDef {
  return {
    name: NAME,
    title: "Calculeaza pretul la raft",
    description:
      "Calculate the shelf price (pret de vanzare cu TVA) from purchase cost without VAT (cost / pret de achizitie " +
      "fara TVA), with adaos comercial (markup_percent) OR marja dorita (target_margin_percent), cota TVA 21 / 11 / 0, " +
      "optional rotunjire la ,x9 or ,49/,99, and optional pret pe kg / pret pe litru (unit price). Returns price with " +
      "VAT, VAT amount, real markup and margin after rounding.",
    inputSchema: {
      type: "object",
      properties: {
        cost: { type: "number", exclusiveMinimum: 0, maximum: 1000000, description: "Costul unitar fara TVA, in lei" },
        vat_rate: { type: "number", enum: [21, 11, 0], description: "Cota TVA la vanzare: 21, 11 sau 0" },
        markup_percent: { type: "number", minimum: 0, maximum: 1000, description: "Adaos comercial in %, aplicat la cost" },
        target_margin_percent: {
          type: "number",
          minimum: 0,
          maximum: 95,
          description: "Marja dorita in % din pretul fara TVA (in loc de adaos)",
        },
        rounding: {
          type: "string",
          enum: ["none", "0.09", "0.49_0.99"],
          description: "none; 0.09 = rotunjire in sus la ,x9; 0.49_0.99 = rotunjire in sus la ,49 sau ,99",
        },
        unit_quantity: {
          type: "number",
          exclusiveMinimum: 0,
          maximum: 100000,
          description: "Cantitatea din ambalaj, pentru pretul pe unitate (de ex. 250 pentru 250 g)",
        },
        unit: { type: "string", enum: ["kg", "g", "l", "ml"], description: "Unitatea pentru unit_quantity" },
      },
      required: ["cost", "vat_rate"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      let p: ShelfPrice;
      try {
        p = calculateShelfPrice(args as unknown as ShelfPriceInput);
      } catch (e) {
        return { text: e instanceof RangeError ? e.message : "Date invalide.", isError: true };
      }
      const url = trackedUrl("/", NAME);
      const lines = [
        `**Pret la raft: ${formatLei(p.price_with_vat)}** (TVA ${formatPercent(p.vat_rate)} inclus)`,
        "",
        `- Cost fara TVA: ${formatLei(p.cost)}`,
        p.rounding !== "none" ? `- Pret calculat inainte de rotunjire: ${formatLei(p.price_before_rounding)}` : null,
        `- Pret fara TVA: ${formatLei(p.price_without_vat)}`,
        `- TVA: ${formatLei(p.vat_amount)}`,
        `- Castig pe bucata: ${formatLei(p.profit)}`,
        `- Adaos real: ${formatPercent(p.markup_percent)} (din cost)`,
        `- Marja reala: ${formatPercent(p.margin_percent)} (din pretul fara TVA)`,
        p.unit_price_label ? `- Pret pe unitate de masura: ${p.unit_price_label}` : null,
        "",
        `Pretul pe kg sau litru trebuie afisat langa pretul de vanzare. Etichete de raft si casa de marcat: ${url}`,
      ].filter((l) => l !== null);
      return { text: lines.join("\n"), structured: { ...p, price_with_vat_text: formatLei(p.price_with_vat), url } };
    },
  };
}
