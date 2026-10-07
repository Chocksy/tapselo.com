import { escapeHtml, fmtLei, fmtMoney, renderShell } from "../generators/page.ts";
import type { ShelfPrice } from "../mcp/answers/shelf-price.ts";
import { formatLei } from "../mcp/text.ts";

export interface AfisInput {
  productName: string;
  storeName: string;
  price: ShelfPrice;
  /** Customer-facing poster: purchase cost and markup are printed only when the owner opts in. */
  showCost?: boolean;
  showMarkup?: boolean;
}

export function renderAfisHtml(i: AfisInput): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr><td>${escapeHtml(label)}</td><td class="num">${strong ? `<b>${escapeHtml(value)}</b>` : escapeHtml(value)}</td></tr>`;
  const rows = [
    row("Preț de vânzare (cu TVA)", formatLei(i.price.price_with_vat), true),
    row(`TVA ${i.price.vat_rate}%`, fmtLei(i.price.vat_amount)),
    row("Preț fără TVA", fmtLei(i.price.price_without_vat)),
    i.showCost ? row("Cost de achiziție (fără TVA)", fmtLei(i.price.cost)) : "",
    i.showMarkup ? row("Adaos comercial", `${fmtMoney(i.price.markup_percent)}%`) : "",
    i.price.unit_price_label ? row("Preț unitar", i.price.unit_price_label) : "",
  ].filter(Boolean);
  const body = `<h1 class="doc-title">Informare preț</h1>
<div class="doc-meta">
<span><b>Magazin:</b> ${escapeHtml(i.storeName)}</span>
<span><b>Produs:</b> ${escapeHtml(i.productName)}</span>
</div>
<table class="doc" style="max-width:120mm;margin:8mm auto">
<tbody>
${rows.join("\n")}
</tbody>
</table>
<p class="note muted">Afiș informativ. Prețul plătit la casă este același cu prețul de la raft.</p>`;
  return renderShell({
    kind: "afis_adaos",
    title: `Afiș preț — ${i.productName}`,
    expiresAt: null,
    body,
    margin: "12mm",
    local: true,
  });
}
