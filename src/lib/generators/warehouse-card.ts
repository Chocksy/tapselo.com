// Fișă de magazie (kind "warehouse_card", form 14-3-8, OMFP 2634/2015). Layout follows the
// official model: unitate, magazie, material, U/M, preț unitar; rows with dată, document
// (număr, fel), intrări, ieșiri, stoc, semnătură de control.

import type { DraftRecord, WarehouseCardPayload } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, fmtQty, formatDate, renderShell } from "./page.ts";

export interface WarehouseCardCalcRow {
  stock: number;
}

export interface WarehouseCardCalc {
  rows: WarehouseCardCalcRow[];
  closing_stock: number;
}

export function warehouseCardCalc(p: Pick<WarehouseCardPayload, "opening_stock" | "rows">): WarehouseCardCalc {
  let stock = roundMoney(p.opening_stock);
  const rows = p.rows.map((r) => {
    const inn = r.entries_in ?? 0;
    const out = r.entries_out ?? 0;
    stock = roundMoney(stock + inn - out);
    return { stock };
  });
  return { rows, closing_stock: stock };
}

export interface RenderOptions {
  local?: boolean;
  /** Empty grid for manual completion on paper. */
  blank?: boolean;
}

export function renderWarehouseCard(
  p: WarehouseCardPayload,
  draft: DraftRecord,
  opts: RenderOptions = {},
): string {
  const blank = opts.blank ?? false;
  const c = blank ? { rows: [], closing_stock: 0 } : warehouseCardCalc(p);
  const rowHtml = blank
    ? Array.from({ length: 12 }, () => "<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join(
        "\n",
      )
    : p.rows
        .map((r, i) => {
          const stock = c.rows[i]?.stock ?? 0;
          const inn = r.entries_in;
          const out = r.entries_out;
          return `<tr>
<td>${escapeHtml(formatDate(r.date) ?? r.date)}</td>
<td>${escapeHtml(r.doc_number)}</td>
<td>${escapeHtml(r.doc_type)}</td>
<td class="num">${inn !== undefined && inn !== 0 ? escapeHtml(fmtQty(inn)) : ""}</td>
<td class="num">${out !== undefined && out !== 0 ? escapeHtml(fmtQty(out)) : ""}</td>
<td class="num">${escapeHtml(fmtQty(stock))}</td>
<td></td>
<td>${escapeHtml(r.control_signature ?? "")}</td>
</tr>`;
        })
        .join("\n");

  const price =
    p.unit_price !== undefined && p.unit_price !== null && !blank
      ? fmtMoney(p.unit_price)
      : blank
        ? ""
        : "";

  const body = `<h1 class="doc-title">Fișă de magazie</h1>
<p class="doc-code">Cod formular 14-3-8 (OMFP nr. 2.634/2015)</p>
<div class="doc-meta">
<span><b>Unitatea:</b> ${blank ? "" : escapeHtml(p.company)}</span>
<span><b>Magazia:</b> ${blank ? "" : escapeHtml(p.warehouse)}</span>
</div>
<div class="doc-meta">
<span><b>Materialul (produsul):</b> ${blank ? "" : escapeHtml(p.product)}</span>
${p.product_code || blank ? `<span><b>Cod:</b> ${blank ? "" : escapeHtml(p.product_code ?? "")}</span>` : ""}
<span><b>U/M:</b> ${blank ? "" : escapeHtml(p.unit)}</span>
<span><b>Preț unitar:</b> ${price ? `${escapeHtml(price)} lei` : ""}</span>
</div>
<table class="doc">
<thead>
<tr>
<th rowspan="2">Data</th>
<th colspan="2">Document</th>
<th rowspan="2">Intrări</th>
<th rowspan="2">Ieșiri</th>
<th rowspan="2">Stoc</th>
<th colspan="2">Data și semnătura de control</th>
</tr>
<tr>
<th>Număr</th>
<th>Fel</th>
<th colspan="2"></th>
</tr>
</thead>
<tbody>
${
  blank
    ? rowHtml
    : `<tr>
<td></td><td></td><td><b>Stoc inițial</b></td>
<td class="num"></td><td class="num"></td><td class="num"><b>${escapeHtml(fmtQty(p.opening_stock))}</b></td><td colspan="2"></td>
</tr>
${rowHtml}`
}
</tbody>
</table>
${
  blank
    ? ""
    : `<p class="doc-foot"><b>Stoc final:</b> ${escapeHtml(fmtQty(c.closing_stock))} ${escapeHtml(p.unit)}</p>`
}
<div class="signs">
<div>Gestionar<span>Nume, prenume, semnătura</span></div>
<div>Compartiment financiar-contabil<span>Nume, prenume, semnătura</span></div>
</div>`;

  return renderShell({
    kind: "warehouse_card",
    title: `Fișă de magazie${blank ? " (model gol)" : ""}`,
    expiresAt: draft.expires_at,
    body,
    local: opts.local,
  });
}
