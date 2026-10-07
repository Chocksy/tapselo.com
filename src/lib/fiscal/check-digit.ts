/**
 * CUI/CIF control digit (cheia 753217532, mod 11).
 * @see https://ro.wikipedia.org/wiki/Num%C4%83r_de_identificare_fiscal%C4%83
 */

const CUI_KEY = "753217532";

export function isValidCuiCheckDigit(cui: string): boolean {
  if (!/^\d{2,10}$/.test(cui)) return false;
  const body = cui.slice(0, -1).padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(CUI_KEY[i]);
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return c === Number(cui[cui.length - 1]);
}

/**
 * NUI (primele 10 cifre din idM) — cifră de control din validatorul oficial A4200 (MReg.checkNUI).
 * @see https://static.anaf.ro/static/10/Anaf/update5/A4200_8/A4200Validator.jar (versiune J1.0.5)
 */
const NUI_WEIGHTS = [7, 8, 6, 2, 1, 3, 4, 5, 9] as const;

export function isValidNuiCheckDigit(nui: string): boolean {
  if (!/^\d{10}$/.test(nui)) return false;
  let val = BigInt(nui);
  let sum = 0n;
  let lastDigit = 0n;
  for (let i = 0; i < 9; i++) {
    const digit = val % 10n;
    val /= 10n;
    if (digit >= 5n) val += 1n;
    sum += digit * BigInt(NUI_WEIGHTS[i]);
    lastDigit = digit;
  }
  // MReg.checkNUI: decrement val when the last loop digit (9th from right) is >= 5.
  if (lastDigit >= 5n) val -= 1n;
  const expected = BigInt(1 + Number(sum % 9n));
  return val === expected;
}
