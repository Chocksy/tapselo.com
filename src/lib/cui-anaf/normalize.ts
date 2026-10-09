import { isValidCuiCheckDigit } from "../fiscal/check-digit.ts";

/** "RO 14399840" -> "14399840"; null when it is not a plausible CUI body. */
export function normalizeCui(raw: unknown): string | null {
  const s = String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^RO/, "");
  return /^[1-9]\d{1,9}$/.test(s) ? s : null;
}

export function isValidCui(cui: string): boolean {
  return isValidCuiCheckDigit(cui);
}
