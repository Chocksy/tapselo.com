// Numbers typed by Romanian shop owners: "1.234,50", "1 234,5", "4,50", "4.50", "12".

export type ParsedNumber = { kind: "empty" } | { kind: "invalid" } | { kind: "ok"; value: number };

const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/;

/**
 * With a comma, the comma is the decimal mark and dots group thousands ("1.234,50").
 * Without a comma, "1.234" / "12.345.678" are thousands; any other single dot is a decimal mark ("4.50").
 * Negative numbers are invalid (none of the tools accept them).
 */
export function parseRoNumber(raw: string, decimals = 2): ParsedNumber {
  let s = raw.trim().replace(/[\s\u00a0]/g, "");
  if (!s) return { kind: "empty" };
  if (s.includes(",")) {
    if ((s.match(/,/g) ?? []).length > 1) return { kind: "invalid" };
    const [int, frac] = s.split(",");
    if (int.includes(".") && !THOUSANDS_ONLY.test(int)) return { kind: "invalid" };
    s = `${int.replace(/\./g, "")}.${frac}`;
  } else if (THOUSANDS_ONLY.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return { kind: "invalid" };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { kind: "invalid" };
  // Shift with an exponent, not n * 10^d: 1.005 * 100 is 100.49999… in binary floating point.
  return { kind: "ok", value: Math.round(Number(`${s}e${decimals}`)) / 10 ** decimals };
}
