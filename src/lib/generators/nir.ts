// Nota de receptie si constatare de diferente (kind "nir", form 14-3-1A), A4 landscape. Layout
// follows the admin app's ReceivingPrintLayout: buyer / supplier boxes, NIR and invoice data,
// lines with documented and received quantity, cost, VAT and sale values, VAT breakdown,
// signature boxes. Retail price method: markup and non-chargeable VAT. Values use the received
// quantity (quantity_received, default = quantity on the document).

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

export function receivedQty(l: NirLine): number {
  return l.quantity_received ?? l.quantity;
}

export function nirLine(l: NirLine, markupPercent?: number): NirLineCalc {
  const qty = receivedQty(l);
  const cost_value = roundMoney(qty * l.unit_cost);
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
  const sale_value = roundMoney(qty * sale_price);
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
.party .tax{font-size:8.5pt;color:#334155}
.vat-sum{width:60%;margin-top:4mm;margin-left:auto}
`;

export interface RenderOptions {
  /** Built in the browser by /unelte (see page.ts renderShell). */
  local?: boolean;
}

const BLANK = "______________";
const orBlank = (v: string | undefined) => (v ? escapeHtml(v) : BLANK);

export function renderNir(p: NirPayload, draft: DraftRecord, opts: RenderOptions = {}): string {
  const t = nirTotals(p);
  const diffs: string[] = [];
  const rows = p.lines
    .map((l, i) => {
      const c = nirLine(l, p.markup_percent);
      const rec = receivedQty(l);
      if (rec !== l.quantity) {
        const d = Math.round((rec - l.quantity) * 1000) / 1000;
        diffs.push(
          `linia ${i + 1} (${escapeHtml(l.name)}): ${escapeHtml(fmtQty(l.quantity))} ${escapeHtml(l.unit)} pe document, ${escapeHtml(fmtQty(rec))} ${escapeHtml(l.unit)} recepționate (${d > 0 ? "+" : ""}${escapeHtml(fmtQty(d))})`,
        );
      }
      return `<tr>
<td class="ctr">${i + 1}</td>
<td>${escapeHtml(l.name)}</td>
<td class="ctr">${escapeHtml(l.unit)}</td>
<td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
<td class="num">${escapeHtml(fmtQty(rec))}</td>
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
  const taxId = (v: string | undefined) => (v ? `<div class="tax">CIF: ${escapeHtml(v)}</div>` : "");
  const body = `<h1 class="doc-title">Notă de recepție și constatare de diferențe (NIR)</h1>
<div class="parties">
<div class="party"><div class="lbl">UNITATEA (CUMPĂRĂTOR)</div><div class="nm">${escapeHtml(p.company)}</div>${taxId(p.company_tax_id)}</div>
<div class="party"><div class="lbl">FURNIZOR</div><div class="nm">${escapeHtml(p.supplier)}</div>${taxId(p.supplier_tax_id)}</div>
</div>
<div class="doc-meta">
<span><b>NIR nr.:</b> ${orBlank(p.nir_number)}</span>
<span><b>Data NIR:</b> ${p.nir_date ? escapeHtml(formatDate(p.nir_date) ?? p.nir_date) : BLANK}</span>
<span><b>Gestiunea:</b> ${orBlank(p.management)}</span>
<span><b>Factura / avizul nr.:</b> ${escapeHtml(p.invoice_number)}</span>
<span><b>Data facturii:</b> ${escapeHtml(formatDate(p.invoice_date) ?? p.invoice_date)}</span>
${p.markup_percent !== undefined ? `<span><b>Adaos comercial:</b> ${escapeHtml(fmtMoney(p.markup_percent))}%</span>` : ""}
<span><b>Valori în lei</b></span>
</div>
<table class="doc">
<thead>
<tr><th rowspan="2">Nr. crt.</th><th rowspan="2">Denumirea bunurilor</th><th rowspan="2">UM</th><th colspan="2">Cantitate</th>
<th colspan="4">Preț de achiziție</th><th colspan="2">Adaos comercial</th><th rowspan="2">TVA neexigibilă</th><th colspan="2">Preț de vânzare (cu TVA)</th></tr>
<tr><th>Conform documentelor</th><th>Recepționată</th><th>Preț unitar fără TVA</th><th>Valoare fără TVA</th><th>TVA %</th><th>Valoare TVA</th><th>%</th><th>Valoare</th><th>Preț unitar</th><th>Valoare</th></tr>
</thead>
<tbody>
${rows}
</tbody>
<tfoot>
<tr><td colspan="6">TOTAL</td><td class="num">${fmtMoney(t.cost_value)}</td><td></td><td class="num">${fmtMoney(t.cost_vat)}</td><td></td>
<td class="num">${t.sale_value ? fmtMoney(t.markup_value) : dash}</td><td class="num">${t.sale_value ? fmtMoney(t.sale_vat) : dash}</td><td></td><td class="num">${t.sale_value ? fmtMoney(t.sale_value) : dash}</td></tr>
</tfoot>
</table>
<table class="doc vat-sum">
<thead><tr><th>Cota TVA</th><th>Baza (achiziție)</th><th>TVA</th><th>Total cu TVA</th></tr></thead>
<tbody>
${vatRows}
</tbody>
<tfoot><tr><td>TOTAL</td><td class="num">${fmtMoney(t.cost_value)}</td><td class="num">${fmtMoney(t.cost_vat)}</td><td class="num">${fmtMoney(t.cost_total)}</td></tr></tfoot>
</table>
${diffs.length ? `<p class="warn">Diferențe la recepție: ${diffs.join("; ")}.</p>` : ""}
${t.complete_sale ? "" : `<p class="note muted">Liniile fără preț de vânzare (nici preț dat, nici adaos) au valorile de vânzare goale.</p>`}
<div class="signs">
<div>Comisia de recepție<span>Nume, prenume, semnătura</span></div>
<div>Primit în gestiune (gestionar)<span>Nume, prenume, semnătura</span></div>
<div>Data primirii în gestiune<span>&nbsp;</span></div>
</div>`;
  return renderShell({
    kind: "nir",
    title: `NIR ${p.nir_number ?? p.invoice_number}`,
    expiresAt: draft.expires_at,
    body,
    css: CSS,
    landscape: true,
    local: opts.local,
  });
}

export function nirSummary(p: NirPayload): string {
  const t = nirTotals(p);
  const parts = [
    `NIR pentru factura ${p.invoice_number} de la ${p.supplier}: ${p.lines.length} linii.`,
    `Valoare de achiziție fără TVA ${fmtMoney(t.cost_value)} lei, TVA ${fmtMoney(t.cost_vat)} lei, total ${fmtMoney(t.cost_total)} lei.`,
  ];
  if (t.sale_value > 0) {
    parts.push(`Valoare de vânzare cu TVA ${fmtMoney(t.sale_value)} lei (adaos ${fmtMoney(t.markup_value)} lei, TVA neexigibilă ${fmtMoney(t.sale_vat)} lei).`);
  }
  if (!t.complete_sale) parts.push("Unele linii nu au preț de vânzare: dă `markup_percent` sau `sale_price` ca să fie completate.");
  return parts.join("\n");
}
