// Borderou de achiziție (cod 14-4-13, OMFP nr. 2.634/2015, Anexa nr. 3): goods bought from
// individuals. Header and table follow the official model (Entitatea, CIF, Registrul comerțului,
// Sediul, Județul; Produsul, Cod, U/M, Cantitate, Preț unitar de achiziție, Valoarea achiziției,
// TOTAL; signatures of the buyer and the storekeeper). The seller block and the optional tax
// withheld at source are extra rows, labelled as such. Pure; every user text goes through escapeHtml.

import type { DraftRecord, PurchaseSlipLine, PurchaseSlipPayload } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, fmtQty, formatDate, renderShell } from "./page.ts";

export interface PurchaseSlipTotals {
  /** Valoarea achiziției per line, same order as `lines`. */
  line_values: number[];
  /** Sum of quantities, or null when the lines mix units (a kg + buc total means nothing). */
  quantity: number | null;
  /** TOTAL of Valoarea achiziției. */
  total: number;
  /** Withheld income tax, 0 when no percent is given. */
  withholding: number;
  /** total - withholding: what the seller is paid. */
  net_payable: number;
}

export function purchaseSlipLineValue(l: PurchaseSlipLine): number {
  return roundMoney(l.quantity * l.unit_price);
}

export function purchaseSlipTotals(p: Pick<PurchaseSlipPayload, "lines" | "withholding_percent">): PurchaseSlipTotals {
  const line_values = p.lines.map(purchaseSlipLineValue);
  const total = roundMoney(line_values.reduce((a, b) => a + b, 0));
  const sameUnit = new Set(p.lines.map((l) => l.unit.trim().toLowerCase())).size === 1;
  const quantity = sameUnit ? Number(p.lines.reduce((a, l) => a + l.quantity, 0).toFixed(3)) : null;
  const rate = p.withholding_percent ?? 0;
  const withholding = rate > 0 ? roundMoney((total * rate) / 100) : 0;
  return { line_values, quantity, total, withholding, net_payable: roundMoney(total - withholding) };
}

export interface RenderOptions {
  local?: boolean;
  pageSize?: "A4" | "A5";
  /** Empty model 14-4-13 for hand filling. */
  blank?: boolean;
  /** Empty table rows on the blank form. */
  blankRows?: number;
}

/** Placeholder payload for the blank form; no field of it is printed when `blank` is set. */
export const BLANK_PURCHASE_SLIP: PurchaseSlipPayload = {
  company: "",
  doc_number: "",
  date: "",
  seller_name: "",
  lines: [],
};

const CSS = `
.doc-code{margin:0 0 4mm;text-align:center;font-size:8pt;color:#475569}
.slip-head{margin:0 0 4mm;font-size:9.5pt;line-height:1.6}
.slip-head p{margin:0}
.slip-title{margin:4mm 0 1mm}
.slip-no{text-align:center;margin:0 0 4mm;font-size:10pt}
.seller{margin:0 0 4mm}
.seller .lbl{width:30%;font-weight:700;background:#f8fafc}
.seller-cap{font-size:9pt;font-weight:700;margin:0 0 1mm}
table.slip td{height:7mm}
table.slip .x{text-align:center}
table.pay{margin-top:3mm;width:60%;margin-left:auto}
table.pay .lbl{font-weight:700;background:#f8fafc}
.slip-signs{display:flex;justify-content:space-between;gap:8mm;margin-top:10mm;font-size:9.5pt}
.slip-signs div{flex:1}
.slip-signs span{display:block;margin-top:10mm;border-top:1px solid #000;padding-top:1mm;font-size:8pt;color:#475569}
.blank-line{display:inline-block;min-width:70mm;border-bottom:1px dotted #000;height:1.1em;vertical-align:bottom}
.blank-line.s{min-width:20mm}
.blank-line.m{min-width:32mm}
.sheet.a5{max-width:148mm;padding:8mm}
.sheet.a5 h1.doc-title{font-size:12pt}
.sheet.a5 table.doc{font-size:7.5pt}
.sheet.a5 .slip-head{font-size:8.5pt}
.sheet.a5 .blank-line{min-width:45mm}
.sheet.a5 table.slip td{height:6mm}
.sheet.a5 table.pay{width:100%}
.sheet.a5 .slip-head,.sheet.a5 .slip-no,.sheet.a5 .doc-code,.sheet.a5 .seller{margin-bottom:2mm}
.sheet.a5 .slip-head{line-height:1.4}
.sheet.a5 .note{font-size:7pt}
.sheet.a5 .slip-signs{margin-top:5mm;gap:4mm;font-size:8pt}
.sheet.a5 .slip-signs span{margin-top:7mm}
`;

const SELLER_NOTE =
  "Rubrică suplimentară: modelul 14-4-13 nu are câmpuri pentru vânzător; pct. 2 din Anexa nr. 1 la OMFP nr. 2.634/2015 cere menționarea părților operațiunii, când este cazul.";

function line(label: string, value: string | undefined, blank: boolean, size = ""): string {
  const v = blank ? `<span class="blank-line${size ? ` ${size}` : ""}"></span>` : escapeHtml(value ?? "");
  return `<p><b>${label}</b> ${v}</p>`;
}

function headBlock(p: PurchaseSlipPayload, blank: boolean): string {
  return `<div class="slip-head">
${line("Entitatea:", p.company, blank)}
${blank || p.company_tax_id ? line("Codul de identificare fiscală:", p.company_tax_id, blank) : ""}
${blank || p.company_trade_register ? line("Numărul de înmatriculare în Registrul comerțului/anul:", p.company_trade_register, blank, "m") : ""}
${blank || p.company_address ? line("Sediul (localitatea, str., număr):", p.company_address, blank) : ""}
${blank || p.company_county ? line("Județul:", p.company_county, blank, "m") : ""}
</div>`;
}

function sellerBlock(p: PurchaseSlipPayload, blank: boolean): string {
  const v = (s?: string) => (blank ? "" : escapeHtml(s ?? ""));
  const idText = blank
    ? `Seria <span class="blank-line s"></span> nr. <span class="blank-line m"></span>`
    : escapeHtml([p.seller_id_type, p.seller_id_series && `seria ${p.seller_id_series}`, p.seller_id_number && `nr. ${p.seller_id_number}`].filter(Boolean).join(" "));
  const rows = [
    `<tr><td class="lbl">Numele și prenumele</td><td>${v(p.seller_name)}</td></tr>`,
    blank || p.seller_address ? `<tr><td class="lbl">Domiciliul</td><td>${v(p.seller_address)}</td></tr>` : "",
    blank || p.seller_id_type || p.seller_id_series || p.seller_id_number ? `<tr><td class="lbl">Actul de identitate</td><td>${idText}</td></tr>` : "",
    blank || p.seller_cnp ? `<tr><td class="lbl">CNP</td><td>${v(p.seller_cnp)}</td></tr>` : "",
  ].join("");
  return `<section class="seller">
<p class="seller-cap">Vânzător (persoană fizică)</p>
<table class="doc"><tbody>${rows}</tbody></table>
<p class="note muted">${escapeHtml(SELLER_NOTE)}</p>
</section>`;
}

function tableBlock(p: PurchaseSlipPayload, t: PurchaseSlipTotals | null, rows: number): string {
  const head = `<thead><tr><th>Produsul</th><th>Cod</th><th>U/M</th><th>Cantitate</th><th>Preț unitar de achiziție</th><th>Valoarea achiziției</th></tr></thead>`;
  const body = t
    ? p.lines
        .map(
          (l, i) => `<tr>
<td>${escapeHtml(l.name)}</td>
<td>${escapeHtml(l.code ?? "")}</td>
<td class="ctr">${escapeHtml(l.unit)}</td>
<td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
<td class="num">${escapeHtml(fmtMoney(l.unit_price))}</td>
<td class="num">${escapeHtml(fmtMoney(t.line_values[i]))}</td>
</tr>`,
        )
        .join("\n")
    : Array.from({ length: rows }, () => "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("\n");
  // The model marks Cod and U/M with X on the TOTAL row.
  const foot = t
    ? `<tfoot><tr><td>TOTAL</td><td class="x">X</td><td class="x">X</td><td class="num">${t.quantity === null ? "" : escapeHtml(fmtQty(t.quantity))}</td><td></td><td class="num">${escapeHtml(fmtMoney(t.total))}</td></tr></tfoot>`
    : `<tfoot><tr><td>TOTAL</td><td class="x">X</td><td class="x">X</td><td></td><td></td><td></td></tr></tfoot>`;
  return `<table class="doc slip">${head}<tbody>${body}</tbody>${foot}</table>`;
}

function payBlock(p: PurchaseSlipPayload, t: PurchaseSlipTotals): string {
  if (!(p.withholding_percent && p.withholding_percent > 0)) return "";
  return `<table class="doc pay"><tbody>
<tr><td class="lbl">Valoarea achiziției</td><td class="num">${escapeHtml(fmtMoney(t.total))} lei</td></tr>
<tr><td class="lbl">Impozit pe venit reținut la sursă (${escapeHtml(fmtQty(p.withholding_percent, 2))}%)</td><td class="num">${escapeHtml(fmtMoney(t.withholding))} lei</td></tr>
<tr><td class="lbl">Suma de plată vânzătorului</td><td class="num">${escapeHtml(fmtMoney(t.net_payable))} lei</td></tr>
</tbody></table>
<p class="note muted">Rubrică suplimentară, completată de cumpărător: impozitul reținut la sursă, unde Codul fiscal îl prevede.</p>`;
}

function signs(p: PurchaseSlipPayload, blank: boolean): string {
  const name = (s?: string) => (blank || !s ? "" : `${escapeHtml(s)}, `);
  return `<div class="slip-signs">
<div>Semnătura achizitorului<span>${name(p.buyer_name)}semnătura</span></div>
<div>Semnătura gestionarului<span>${name(p.storekeeper_name)}semnătura</span></div>
<div>Vânzător (persoană fizică)<span>${name(blank ? "" : p.seller_name)}semnătura</span></div>
</div>`;
}

export function renderPurchaseSlip(p: PurchaseSlipPayload, draft: DraftRecord, opts: RenderOptions = {}): string {
  const pageSize = opts.pageSize ?? "A4";
  const blank = !!opts.blank;
  const t = blank ? null : purchaseSlipTotals(p);
  const no = blank
    ? `nr. <span class="blank-line s"></span> data <span class="blank-line m"></span>`
    : `nr. ${escapeHtml(p.doc_number)} data ${escapeHtml(formatDate(p.date) ?? p.date)}`;
  const body = `${headBlock(p, blank)}
<h1 class="doc-title slip-title">Borderou de achiziție</h1>
<p class="slip-no">${no}</p>
<p class="doc-code">Cod formular 14-4-13 (OMFP nr. 2.634/2015, Anexa nr. 3)</p>
${sellerBlock(p, blank)}
${tableBlock(p, t, opts.blankRows ?? (pageSize === "A5" ? 7 : 14))}
${t ? payBlock(p, t) : ""}
${signs(p, blank)}`;
  return renderShell({
    kind: "purchase_slip",
    title: blank ? "Borderou de achiziție (model necompletat)" : `Borderou de achiziție nr. ${p.doc_number}`,
    expiresAt: draft.expires_at,
    body,
    css: CSS,
    margin: pageSize === "A5" ? "8mm" : "10mm",
    pageSize,
    sheetClass: [pageSize === "A5" ? "a5" : "", blank ? "blank" : ""].filter(Boolean).join(" ") || undefined,
    local: opts.local,
  });
}
