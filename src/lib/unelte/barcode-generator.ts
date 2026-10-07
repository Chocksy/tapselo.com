import { escapeHtml, renderShell } from "../generators/page.ts";
import { eanCheckDigit, isValidEan, isValidEan13 } from "../ean13.ts";

export type BarcodeFormat = "ean13" | "ean8" | "code128";

export const CODE128_MAX_LENGTH = 80;
export const LABEL_COPIES_MIN = 1;
export const LABEL_COPIES_MAX = 48;

export function stripBarcodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export type ResolveResult = { ok: true; value: string; checkDigitAdded?: boolean } | { ok: false; message: string };

/** EAN-13: 12 data digits get the 13th computed; 13 digits are validated. */
export function resolveEan13Input(raw: string): ResolveResult {
  const digits = stripBarcodeInput(raw);
  if (/^\d{12}$/.test(digits)) {
    const cd = eanCheckDigit(digits);
    if (cd === null) return { ok: false, message: "Codul trebuie să conțină 12 sau 13 cifre." };
    return { ok: true, value: `${digits}${cd}`, checkDigitAdded: true };
  }
  if (/^\d{13}$/.test(digits)) {
    if (!isValidEan13(digits)) {
      return { ok: false, message: "Cifra de control nu este corectă. Verifică cele 13 cifre sau introdu doar primele 12." };
    }
    return { ok: true, value: digits };
  }
  if (!digits.length) return { ok: false, message: "Introdu codul EAN-13 (12 sau 13 cifre)." };
  return { ok: false, message: "Codul EAN-13 are 12 cifre (fără control) sau 13 cifre (cu control)." };
}

/** EAN-8: 7 data digits get the 8th computed; 8 digits are validated. */
export function resolveEan8Input(raw: string): ResolveResult {
  const digits = stripBarcodeInput(raw);
  if (/^\d{7}$/.test(digits)) {
    const cd = eanCheckDigit(digits);
    if (cd === null) return { ok: false, message: "Codul trebuie să conțină 7 sau 8 cifre." };
    return { ok: true, value: `${digits}${cd}`, checkDigitAdded: true };
  }
  if (/^\d{8}$/.test(digits)) {
    if (!isValidEan(digits)) {
      return { ok: false, message: "Cifra de control nu este corectă. Verifică cele 8 cifre sau introdu doar primele 7." };
    }
    return { ok: true, value: digits };
  }
  if (!digits.length) return { ok: false, message: "Introdu codul EAN-8 (7 sau 8 cifre)." };
  return { ok: false, message: "Codul EAN-8 are 7 cifre (fără control) sau 8 cifre (cu control)." };
}

/** Code 128 subset B: printable ASCII, bounded length for readable labels. */
export function resolveCode128Input(raw: string): ResolveResult {
  const text = raw.trim();
  if (!text.length) return { ok: false, message: "Introdu textul pentru codul Code 128." };
  if (text.length > CODE128_MAX_LENGTH) {
    return { ok: false, message: `Textul poate avea maximum ${CODE128_MAX_LENGTH} caractere.` };
  }
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) {
      return { ok: false, message: "Folosește doar caractere ASCII imprimabile (litere, cifre, spațiu, simboluri)." };
    }
  }
  return { ok: true, value: text };
}

export function resolveBarcodeInput(format: BarcodeFormat, raw: string): ResolveResult {
  switch (format) {
    case "ean13":
      return resolveEan13Input(raw);
    case "ean8":
      return resolveEan8Input(raw);
    case "code128":
      return resolveCode128Input(raw);
    default: {
      const never: never = format;
      throw new Error(`unexpected format ${String(never)}`);
    }
  }
}

export function clampLabelCopies(n: number): number {
  if (!Number.isFinite(n)) return LABEL_COPIES_MIN;
  return Math.min(LABEL_COPIES_MAX, Math.max(LABEL_COPIES_MIN, Math.round(n)));
}

export interface BarcodeLabelSheetInput {
  productName: string;
  barcodeValue: string;
  /** Inline SVG from JsBarcode; generated locally, not user HTML. */
  barcodeSvg: string;
  copies: number;
}

export function renderBarcodeLabelSheetHtml(i: BarcodeLabelSheetInput): string {
  const copies = clampLabelCopies(i.copies);
  const name = i.productName.trim();
  const cells = Array.from({ length: copies }, () => {
    const title = name ? `<p class="label-name">${escapeHtml(name)}</p>` : "";
    return `<div class="label">${title}<div class="label-barcode">${i.barcodeSvg}</div><p class="label-code">${escapeHtml(i.barcodeValue)}</p></div>`;
  }).join("\n");
  const body = `<h1 class="doc-title">Etichete cod de bare</h1>
<div class="label-grid" role="list">${cells}</div>
<p class="note muted">Etichete generate local în browser. Verifică scanarea înainte de lipire pe raft.</p>`;
  return renderShell({
    kind: "barcode_labels",
    title: name ? `Etichete — ${name}` : "Etichete cod de bare",
    expiresAt: null,
    body,
    margin: "10mm",
    local: true,
    css: `
.label-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:6mm;}
.label{border:1px dashed #94a3b8;padding:3mm;text-align:center;break-inside:avoid;page-break-inside:avoid;}
.label-name{font-size:9pt;font-weight:600;margin:0 0 2mm;line-height:1.2;}
.label-barcode svg{display:block;width:100%;max-width:58mm;height:auto;margin:0 auto;}
.label-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8pt;margin:1.5mm 0 0;}
@media print{
  .label-grid{gap:3mm;}
  .label{border-color:#cbd5e1;}
}
`,
  });
}
