// EAN-13 / EAN-8 check digits and an EAN-13 SVG barcode. Pure, no dependencies.
// Used by the shelf labels generator (src/lib/generators/labels.ts) and the MCP tools.

/** Check digit for the 7 (EAN-8) or 12 (EAN-13) data digits; null when the input is not that. */
export function eanCheckDigit(body: string): number | null {
  if (!/^(\d{7}|\d{12})$/.test(body)) return null;
  let sum = 0;
  // Weights from the right: 3, 1, 3, 1, ...
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}

/** True for an 8 or 13 digit code with a correct check digit. */
export function isValidEan(code: unknown): boolean {
  if (typeof code !== "string" || !/^(\d{8}|\d{13})$/.test(code)) return false;
  return eanCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

export function isValidEan13(code: unknown): boolean {
  return typeof code === "string" && code.length === 13 && isValidEan(code);
}

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const G = R.map((p) => [...p].reverse().join(""));
// Parity of the left six digits, chosen by the first digit.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** The 95 modules of an EAN-13 ("1" = bar), or null when the code is not a valid EAN-13. */
export function ean13Modules(code: string): string | null {
  if (!isValidEan13(code)) return null;
  const d = [...code].map(Number);
  const parity = PARITY[d[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? L : G)[d[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + "101";
}

const QUIET_LEFT = 11;
const QUIET_RIGHT = 7;
const BAR_H = 50;
const GUARD_H = 56;

/** Inline SVG of an EAN-13 with guard bars and the digits under the bars; null when invalid. */
export function ean13Svg(code: string): string | null {
  const bits = ean13Modules(code);
  if (!bits) return null;
  const isGuard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  let d = "";
  for (let i = 0; i < bits.length; ) {
    if (bits[i] !== "1") {
      i++;
      continue;
    }
    // One rect per run of bars with the same height.
    const guard = isGuard(i);
    let j = i;
    while (j < bits.length && bits[j] === "1" && isGuard(j) === guard) j++;
    d += `M${QUIET_LEFT + i} 0h${j - i}v${guard ? GUARD_H : BAR_H}h-${j - i}z`;
    i = j;
  }
  const width = QUIET_LEFT + 95 + QUIET_RIGHT;
  const textY = BAR_H + 9;
  const digit = (x: number, ch: string) => `<text x="${x}" y="${textY}">${ch}</text>`;
  let text = digit(QUIET_LEFT - 6, code[0]);
  for (let i = 0; i < 6; i++) text += digit(QUIET_LEFT + 3 + 7 * i + 3.5, code[1 + i]);
  for (let i = 0; i < 6; i++) text += digit(QUIET_LEFT + 50 + 7 * i + 3.5, code[7 + i]);
  return `<svg class="ean" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${textY + 2}" role="img" aria-label="Cod de bare ${code}" shape-rendering="crispEdges"><rect width="${width}" height="${textY + 2}" fill="#fff"/><path d="${d}" fill="#000"/><g font-family="ui-monospace,Menlo,Consolas,monospace" font-size="9" text-anchor="middle" fill="#000">${text}</g></svg>`;
}
