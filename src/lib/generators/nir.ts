// Nota de intrare-receptie (kind "nir"), A4 landscape. Layout follows the admin app's
// ReceivingPrintLayout: buyer / supplier boxes, invoice data, lines with cost, VAT and sale
// values, VAT breakdown, signature boxes. Retail price method: markup and non-chargeable VAT.

import type { DraftRecord, NirLine, NirPayload } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, fmtQty, formatDate, renderShell } from "./page.ts";

export interface NirLineCalc {
  /** quantity x unit_cost, without VAT */
  cost_value: number;
  cost_vat: number;
  /** cost_value + cost_vat */
  cost_total: number;
  /** Sale price per unit with VAT: given, or from the markup; null when neither. */
  sale_price: number | null;
  /** quantity x sale_price, with VAT */
  sale_value: number | null;
  /** VAT inside the sale value (TVA neexigibil) */
  sale_vat: number | null;
  /** sale value without VAT - cost value */
  markup_value: number | null;
  /** markup on cost, percent */
  markup_percent: number | null;
}

export interface NirTotals {
  cost_value: number;
  cost_vat: number;
  cost_total: number;
  sale_value: number;
  sale_vat: number;
  markup_value: number;
  /** true when every line has a sale price */
  complete_sale: boolean;
  vat_groups: { rate: number; base: number; vat: number; total: number }[];
}

export function nirLine(l: NirLine, markupPercent?: number): NirLineCalc {
  const cost_value = roundMoney(l.quantity * l.unit_cost);
  const cost_vat = roundMoney((cost_value * l.vat_rate) / 100);
  const cost_total = roundMoney(cost_value + cost_vat);
  let sale_price: number | null = null;
  if (l.sale_price !== undefined && l.sale_price !== null) sale_price = roundMoney(l.sale_price);
  else if (markupPercent !== undefined && markupPercent !== null) {
    sale_price = roundMoney(l.unit_cost * (1 + markupPercent / 100) * (1 + l.vat_rate / 100));
  }
  if (sale_price === null) {
    return { cost_value, cost_vat, cost_total, sale_price, sale_value: null, sale_vat: null, markup_value: null, markup_percent: null };
  }
  const sale_value = roundMoney(l.quantity * sale_price);
  const sale_base = roundMoney(sale_value / (1 + l.vat_rate / 100));
  const sale_vat = roundMoney(sale_value - sale_base);
  const markup_value = roundMoney(sale_base - cost_value);
  const markup_percent = cost_value > 0 ? roundMoney((markup_value / cost_value) * 100) : null;
  return { cost_value, cost_vat, cost_total, sale_price, sale_value, sale_vat, markup_value, markup_percent };
}

export function nirTotals(p: Pick<NirPayload, "lines" | "markup_percent">): NirTotals {
  const t: NirTotals = { cost_value: 0, cost_vat: 0, cost_total: 0, sale_value: 0, sale_vat: 0, markup_value: 0, complete_sale: true, vat_groups: [] };
  const groups = new Map<number, { rate: number; base: number; vat: number; total: number }>();
  for (const l of p.lines) {
    const c = nirLine(l, p.markup_percent);
    t.cost_value += c.cost_value;
    t.cost_vat += c.cost_vat;
    t.cost_total += c.cost_total;
    if (c.sale_value === null) t.complete_sale = false;
    else {
      t.sale_value += c.sale_value;
      t.sale_vat += c.sale_vat ?? 0;
      t.markup_value += c.markup_value ?? 0;
    }
    const g = groups.get(l.vat_rate) ?? { rate: l.vat_rate, base: 0, vat: 0, total: 0 };
    g.base += c.cost_value;
    g.vat += c.cost_vat;
    g.total += c.cost_total;
    groups.set(l.vat_rate, g);
  }
  for (const k of ["cost_value", "cost_vat", "cost_total", "sale_value", "sale_vat", "markup_value"] as const) t[k] = roundMoney(t[k]);
  t.vat_groups = [...groups.values()]
    .sort((a, b) => a.rate - b.rate)
    .map((g) => ({ rate: g.rate, base: roundMoney(g.base), vat: roundMoney(g.vat), total: roundMoney(g.total) }));
  return t;
}

const dash = "—";
const m = (n: number | null) => (n === null ? dash : fmtMoney(n));

const CSS = `
.parties{display:flex;gap:6mm;margin:0 0 4mm}
.party{flex:1;border:1px solid #94a3b8;padding:2mm 3mm;font-size:9pt}
.party .lbl{font-size:7.5pt;font-weight:700;color:#475569;letter-spacing:.05em}
.party .nm{font-size:10.5pt;font-weight:700}
.vat-sum{width:60%;margin-top:4mm;margin-left:auto}
`;

export function renderNir(p: NirPayload, draft: DraftRecord): string {
  const t = nirTotals(p);
  const rows = p.lines
    .map((l, i) => {
      const c = nirLine(l, p.markup_percent);
      return `<tr>
<td class="ctr">${i + 1}</td>
<td>${escapeHtml(l.name)}</td>
<td class="ctr">${escapeHtml(l.unit)}</td>
<td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
<td class="num">${escapeHtml(fmtMoney(l.unit_cost))}</td>
<td class="num">${escapeHtml(fmtMoney(c.cost_value))}</td>
<td class="ctr">${escapeHtml(String(l.vat_rate))}%</td>
<td class="num">${escapeHtml(fmtMoney(c.cost_vat))}</td>
<td class="num">${escapeHtml(c.markup_percent === null ? dash : `${fmtMoney(c.markup_percent)}%`)}</td>
<td class="num">${escapeHtml(m(c.markup_value))}</td>
<td class="num">${escapeHtml(m(c.sale_vat))}</td>
<td class="num">${escapeHtml(m(c.sale_price))}</td>
<td class="num">${escapeHtml(m(c.sale_value))}</td>
</tr>`;
    })
    .join("\n");
  const vatRows = t.vat_groups
    .map((g) => `<tr><td>TVA ${escapeHtml(String(g.rate))}%</td><td class="num">${fmtMoney(g.base)}</td><td class="num">${fmtMoney(g.vat)}</td><td class="num">${fmtMoney(g.total)}</td></tr>`)
    .join("\n");
  const body = `<h1 class="doc-title">Nota de intrare-receptie</h1>
<div class="parties">
<div class="party"><div class="lbl">UNITATEA (CUMPARATOR)</div><div class="nm">${escapeHtml(p.company)}</div></div>
<div class="party"><div class="lbl">FURNIZOR</div><div class="nm">${escapeHtml(p.supplier)}</div></div>
</div>
<div class="doc-meta">
<span><b>Factura nr.:</b> ${escapeHtml(p.invoice_number)}</span>
<span><b>Data facturii:</b> ${escapeHtml(formatDate(p.invoice_date) ?? p.invoice_date)}</span>
${p.markup_percent !== undefined ? `<span><b>Adaos comercial:</b> ${escapeHtml(fmtMoney(p.markup_percent))}%</span>` : ""}
<span><b>Valori in lei</b></span>
</div>
<table class="doc">
<thead>
<tr><th rowspan="2">Nr.</th><th rowspan="2">Denumire produs</th><th rowspan="2">UM</th><th rowspan="2">Cant.</th>
<th colspan="4">Pret de achizitie</th><th colspan="2">Adaos comercial</th><th rowspan="2">TVA neexigibil</th><th colspan="2">Pret de vanzare (cu TVA)</th></tr>
<tr><th>Pret unitar fara TVA</th><th>Valoare fara TVA</th><th>TVA %</th><th>Valoare TVA</th><th>%</th><th>Valoare</th><th>Pret unitar</th><th>Valoare</th></tr>
</thead>
<tbody>
${rows}
</tbody>
<tfoot>
<tr><td colspan="5">TOTAL</td><td class="num">${fmtMoney(t.cost_value)}</td><td></td><td class="num">${fmtMoney(t.cost_vat)}</td><td></td>
<td class="num">${t.sale_value ? fmtMoney(t.markup_value) : dash}</td><td class="num">${t.sale_value ? fmtMoney(t.sale_vat) : dash}</td><td></td><td class="num">${t.sale_value ? fmtMoney(t.sale_value) : dash}</td></tr>
</tfoot>
</table>
<table class="doc vat-sum">
<thead><tr><th>Cota TVA</th><th>Baza (achizitie)</th><th>TVA</th><th>Total cu TVA</th></tr></thead>
<tbody>
${vatRows}
</tbody>
<tfoot><tr><td>TOTAL</td><td class="num">${fmtMoney(t.cost_value)}</td><td class="num">${fmtMoney(t.cost_vat)}</td><td class="num">${fmtMoney(t.cost_total)}</td></tr></tfoot>
</table>
${t.complete_sale ? "" : `<p class="note muted">Liniile fara pret de vanzare (nici pret dat, nici adaos) au valorile de vanzare goale.</p>`}
<div class="signs">
<div>Comisia de receptie<span>Nume, prenume, semnatura</span></div>
<div>Gestionar (am primit marfa)<span>Nume, prenume, semnatura</span></div>
<div>Data receptiei<span>&nbsp;</span></div>
</div>`;
  return renderShell({ kind: "nir", title: `NIR ${p.invoice_number}`, expiresAt: draft.expires_at, body, css: CSS, landscape: true });
}

export function nirSummary(p: NirPayload): string {
  const t = nirTotals(p);
  const parts = [
    `NIR pentru factura ${p.invoice_number} de la ${p.supplier}: ${p.lines.length} linii.`,
    `Valoare achizitie fara TVA ${fmtMoney(t.cost_value)} lei, TVA ${fmtMoney(t.cost_vat)} lei, total ${fmtMoney(t.cost_total)} lei.`,
  ];
  if (t.sale_value > 0) {
    parts.push(`Valoare de vanzare cu TVA ${fmtMoney(t.sale_value)} lei (adaos ${fmtMoney(t.markup_value)} lei, TVA neexigibil ${fmtMoney(t.sale_vat)} lei).`);
  }
  if (!t.complete_sale) parts.push("Unele linii nu au pret de vanzare: da `markup_percent` sau `sale_price` ca sa fie completate.");
  return parts.join("\n");
}
