const CUI_KEY = "753217532";

export function normalizeCui(raw) {
  const s = String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^RO/, "");
  return /^[1-9]\d{1,9}$/.test(s) ? s : null;
}

export function isValidCuiCheckDigit(cui) {
  if (!/^\d{2,10}$/.test(cui)) return false;
  const body = cui.slice(0, -1).padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(CUI_KEY[i]);
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return c === Number(cui[cui.length - 1]);
}

export function isValidCui(cui) {
  return isValidCuiCheckDigit(cui);
}
