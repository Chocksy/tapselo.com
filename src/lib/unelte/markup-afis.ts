import { escapeHtml, fmtLei, fmtMoney, renderShell } from "../generators/page.ts";
import type { ShelfPrice } from "../mcp/answers/shelf-price.ts";
import { formatLei } from "../mcp/text.ts";

export interface AfisInput {
  productName: string;
  storeName: string;
  price: ShelfPrice;
  /** Food retail: show plafonare note when markup exceeds cap */
  foodRetail?: boolean;
}

const FOOD_MARKUP_CAP = 300;

export function foodMarkupWarning(markupPercent: number): string | null {
  if (markupPercent <= FOOD_MARKUP_CAP) return null;
  return `Adaosul de ${fmtMoney(markupPercent)}% depășește plafonul legal de ${FOOD_MARKUP_CAP}% pentru produse alimentare de bază (Legea nr. 81/2022). Verifică încadrarea produsului cu contabilul.`;
}

export function renderAfisHtml(i: AfisInput): string {
  const warn = i.foodRetail ? foodMarkupWarning(i.price.markup_percent) : null;
  const body = `<h1 class="doc-title">Informare preț</h1>
<div class="doc-meta">
<span><b>Magazin:</b> ${escapeHtml(i.storeName)}</span>
<span><b>Produs:</b> ${escapeHtml(i.productName)}</span>
</div>
<table class="doc" style="max-width:120mm;margin:8mm auto">
<tbody>
<tr><td>Preț de vânzare (cu TVA)</td><td class="num"><b>${escapeHtml(formatLei(i.price.price_with_vat))}</b></td></tr>
<tr><td>TVA ${escapeHtml(String(i.price.vat_rate))}%</td><td class="num">${escapeHtml(fmtLei(i.price.vat_amount))}</td></tr>
<tr><td>Preț fără TVA</td><td class="num">${escapeHtml(fmtLei(i.price.price_without_vat))}</td></tr>
<tr><td>Cost achiziție (fără TVA)</td><td class="num">${escapeHtml(fmtLei(i.price.cost))}</td></tr>
<tr><td>Adaos comercial</td><td class="num">${escapeHtml(fmtMoney(i.price.markup_percent))}%</td></tr>
${i.price.unit_price_label ? `<tr><td>Preț unitar</td><td class="num">${escapeHtml(i.price.unit_price_label)}</td></tr>` : ""}
</tbody>
</table>
${warn ? `<p class="warn">${escapeHtml(warn)}</p>` : ""}
<p class="note muted">Afiș informativ pentru consumatori. Prețul de la raft este cel afișat la casă.</p>`;
  return renderShell({
    kind: "afis_adaos",
    title: `Afiș adaos — ${i.productName}`,
    expiresAt: null,
    body,
    margin: "12mm",
  });
}
