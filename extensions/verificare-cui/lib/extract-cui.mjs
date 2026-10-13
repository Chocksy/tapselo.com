import { isValidCui, normalizeCui } from "./normalize.mjs";

const CUI_TOKEN = /\b(?:RO\s*)?([1-9]\d{1,9})\b/gi;

/**
 * Finds the first valid-format CUI (with check digit) in arbitrary selected text.
 */
export function extractCuiFromText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const whole = normalizeCui(raw);
  if (whole && isValidCui(whole)) return whole;

  for (const match of raw.matchAll(CUI_TOKEN)) {
    const candidate = normalizeCui(match[0]);
    if (candidate && isValidCui(candidate)) return candidate;
  }
  return null;
}
