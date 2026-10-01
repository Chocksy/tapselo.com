// decode_scale_barcode: reads a scale label barcode (Dibal and similar).
// Weight mode is a port of parseScaleBarcode (pos/apps/pos/src/lib/db/catalog.ts):
// 28 + 5-digit PLU + 5-digit weight in grams + check digit, PLU 1..999.

import type { ToolDef } from "../types.ts";
import { formatLei, formatNumber } from "../text.ts";
import { eanCheckDigit } from "../../ean13.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";

const NAME = "decode_scale_barcode";
const PAGE = "/ghid/cantar-dibal";

export interface ScaleBarcodeData {
  scaleCode: string;
  weightKg: number;
}

/** Exact port of the POS parser. Null when it is not a weight barcode the POS accepts. */
export function parseScaleBarcode(barcode: string): ScaleBarcodeData | null {
  if (!/^28\d{11}$/.test(barcode)) return null;
  const pluNumber = parseInt(barcode.substring(2, 7), 10);
  const weightNumber = parseInt(barcode.substring(7, 12), 10);
  if (pluNumber < 1 || pluNumber > 999) return null;
  return { scaleCode: String(pluNumber), weightKg: weightNumber / 1000 };
}

export type DecodeResult =
  | {
      ok: true;
      mode: "weight" | "price";
      barcode: string;
      prefix: string;
      plu: number;
      weight_kg: number | null;
      price_lei: number | null;
      check_digit: number;
      expected_check_digit: number;
      check_digit_valid: boolean;
      pos_accepts: boolean;
      warnings: string[];
    }
  | { ok: false; barcode: string; error: string };

export function decodeScaleBarcode(raw: string, mode: "weight" | "price" = "weight"): DecodeResult {
  const barcode = String(raw ?? "").replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(barcode)) {
    return { ok: false, barcode, error: "Codul de bare de cantar are 13 cifre (EAN-13). Verifica cifrele." };
  }
  if (barcode[0] !== "2") {
    return {
      ok: false,
      barcode,
      error:
        "Codul nu incepe cu 2, deci nu este un cod de cantar (codurile 20-29 sunt pentru uz intern in magazin). " +
        "Probabil este un EAN normal de produs.",
    };
  }
  const prefix = barcode.slice(0, 2);
  const plu = parseInt(barcode.slice(2, 7), 10);
  const value = parseInt(barcode.slice(7, 12), 10);
  const check = Number(barcode[12]);
  const expected = eanCheckDigit(barcode.slice(0, 12));
  const warnings: string[] = [];
  if (check !== expected) warnings.push(`Cifra de control este ${check}, dar ar trebui sa fie ${expected}. Scannerul poate refuza codul.`);
  if (plu < 1 || plu > 999) warnings.push(`PLU ${plu} este in afara intervalului 1-999 folosit de POS.`);
  if (mode === "weight") {
    if (prefix !== "28") warnings.push(`Prefixul este ${prefix}. Pentru coduri cu greutate POS-ul Tapselo citeste doar prefixul 28.`);
    if (value === 0) warnings.push("Greutatea este 0 g. Verifica tara si cantarirea.");
  }
  const posAccepts = mode === "weight" && parseScaleBarcode(barcode) !== null;
  return {
    ok: true,
    mode,
    barcode,
    prefix,
    plu,
    weight_kg: mode === "weight" ? value / 1000 : null,
    price_lei: mode === "price" ? value / 100 : null,
    check_digit: check,
    expected_check_digit: expected,
    check_digit_valid: check === expected,
    pos_accepts: posAccepts,
    warnings,
  };
}

export function createDecodeScaleBarcodeTool(): ToolDef {
  return {
    name: NAME,
    title: "Decodeaza cod de bare de cantar",
    description:
      "Decode a 13-digit scale label barcode (cod de bare cantar Dibal, eticheta cu greutate sau pret) into PLU " +
      "(cod cantar), weight in kg or price, and check digit validity. Default format 28 + PLU(5) + grame(5) + " +
      "cifra de control (28CCCCCWWWWWX). Use mode \"price\" for labels that encode the price (pret in bani).",
    inputSchema: {
      type: "object",
      properties: {
        barcode: { type: "string", minLength: 8, maxLength: 20, description: "Codul de bare, 13 cifre, de ex. 2800123012345" },
        mode: {
          type: "string",
          enum: ["weight", "price"],
          description: "weight (implicit): ultimele 5 cifre = grame; price: ultimele 5 cifre = pret in bani",
        },
      },
      required: ["barcode"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      const r = decodeScaleBarcode(String(args.barcode), args.mode === "price" ? "price" : "weight");
      const url = trackedUrl(PAGE, NAME);
      if (!r.ok) return { text: `${r.error}\n\nGhid cantare Dibal: ${url}`, structured: { ...r, url }, isError: true };
      const lines = [
        `Cod de bare: ${r.barcode}`,
        `- Prefix: ${r.prefix}`,
        `- PLU (cod cantar): ${r.plu}`,
        r.weight_kg !== null
          ? `- Greutate: ${formatNumber(r.weight_kg, 3)} kg (${formatNumber(r.weight_kg * 1000, 0)} g)`
          : `- Pret: ${formatLei(r.price_lei ?? 0)}`,
        `- Cifra de control: ${r.check_digit} (${r.check_digit_valid ? "corecta" : `gresita, corect ar fi ${r.expected_check_digit}`})`,
        r.mode === "weight"
          ? `- POS-ul Tapselo il citeste: ${r.pos_accepts ? "da, cauta produsul cu acest cod cantar" : "nu"}`
          : null,
        ...r.warnings.map((w) => `- Atentie: ${w}`),
        "",
        `Ghid cantare Dibal: ${url}`,
      ].filter((l) => l !== null);
      return { text: lines.join("\n"), structured: { ...r, url } };
    },
  };
}
