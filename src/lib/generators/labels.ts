// Shelf labels (kind "labels"): A4 grid, 3 x 7 labels per page. Each label has the name,
// the big price, the unit price (per kg / l / buc, mandatory on the shelf) and an EAN-13
// barcode when the code is valid.

import { ean13Svg, isValidEan } from "../ean13.ts";
import type { DraftRecord, LabelProduct, LabelsPayload } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, renderShell } from "./page.ts";

export interface UnitPrice {
  value: number;
  per: "kg" | "l" | "buc";
}

const TO_BASE: Record<string, { factor: number; per: UnitPrice["per"] }> = {
  g: { factor: 0.001, per: "kg" },
  kg: { factor: 1, per: "kg" },
  ml: { factor: 0.001, per: "l" },
  cl: { factor: 0.01, per: "l" },
  l: { factor: 1, per: "l" },
  buc: { factor: 1, per: "buc" },
};

/**
 * Price per kg / l / piece.
 * - unit_quantity + unit_label: 250 g at 12,50 -> 50,00 lei/kg
 * - sold by kg or l (unit "kg" / "l") without a quantity: the price is already per unit
 * - otherwise null (the label shows an empty line to fill in by hand)
 */
export function unitPrice(p: Pick<LabelProduct, "price" | "unit" | "unit_quantity" | "unit_label">): UnitPrice | null {
  if (p.unit_quantity && p.unit_label && TO_BASE[p.unit_label]) {
    const { factor, per } = TO_BASE[p.unit_label];
    const base = p.unit_quantity * factor;
    if (base <= 0) return null;
    return { value: roundMoney(p.price / base), per };
  }
  const u = (p.unit ?? "").trim().toLowerCase();
  if (u === "kg" || u === "l") return { value: roundMoney(p.price), per: u };
  return null;
}

function contentLabel(p: LabelProduct): string {
  if (!p.unit_quantity || !p.unit_label) return "";
  return `${String(p.unit_quantity).replace(".", ",")} ${p.unit_label}`;
}

function renderLabel(p: LabelProduct): string {
  const up = unitPrice(p);
  const svg = p.ean && p.ean.length === 13 ? ean13Svg(p.ean) : null;
  // EAN-8 and invalid codes: digits only, no barcode.
  const eanText = p.ean && !svg ? p.ean : "";
  const content = contentLabel(p);
  const [lei, bani] = fmtMoney(p.price).split(",");
  return `<article class="lbl">
<h2>${escapeHtml(p.name)}${content ? ` <small>${escapeHtml(content)}</small>` : ""}</h2>
<p class="price"><b>${escapeHtml(lei)}</b><sup>,${escapeHtml(bani)}</sup><span>lei / ${escapeHtml(p.unit)}</span></p>
<p class="up">${up ? `Pret unitar: <b>${escapeHtml(fmtMoney(up.value))} lei / ${escapeHtml(up.per)}</b>` : "Pret unitar: ............ lei / kg"}</p>
${svg ? `<div class="bc">${svg}</div>` : eanText ? `<p class="ean">EAN ${escapeHtml(eanText)}</p>` : ""}
</article>`;
}

const CSS = `
.labels{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px dashed #94a3b8;border-left:1px dashed #94a3b8}
.lbl{display:flex;flex-direction:column;height:38mm;padding:2mm 3mm;border-right:1px dashed #94a3b8;border-bottom:1px dashed #94a3b8;overflow:hidden;break-inside:avoid}
.lbl h2{margin:0;font-size:9.5pt;line-height:1.2;font-weight:700;max-height:2.4em;overflow:hidden;overflow-wrap:anywhere}
.lbl h2 small{font-weight:400;color:#334155}
.price{display:flex;align-items:flex-start;gap:.5mm;margin:1mm 0 0;line-height:1}
.price b{font-size:24pt;font-weight:900;letter-spacing:-.02em}
.price sup{font-size:12pt;font-weight:800;margin-top:1mm}
.price span{align-self:flex-end;margin-left:1.5mm;font-size:8pt;font-weight:700}
.up{margin:1mm 0 0;font-size:7.5pt}
.bc{margin-top:auto;height:11mm}
.bc svg{display:block;height:100%;width:auto}
.ean{margin:auto 0 0;font-size:7pt;font-family:ui-monospace,Menlo,Consolas,monospace}
.lbl-note{margin:0 0 3mm;font-size:9pt}
@media print{.labels{border-color:#cbd5e1}.lbl{border-color:#cbd5e1}.lbl-note{display:none}}
`;

export function renderLabels(p: LabelsPayload, draft: DraftRecord): string {
  const body = `<p class="lbl-note no-print muted">Taie etichetele pe liniile punctate. ${p.products.length} etichete, 21 pe pagina A4.</p>
<section class="labels">
${p.products.map(renderLabel).join("\n")}
</section>`;
  return renderShell({ kind: "labels", title: "Etichete de raft", expiresAt: draft.expires_at, body, css: CSS, margin: "8mm 6mm" });
}

export function labelsSummary(p: LabelsPayload): string {
  const noUnit = p.products.filter((x) => !unitPrice(x)).map((x) => x.name);
  const badEan = p.products.filter((x) => x.ean && !isValidEan(x.ean)).map((x) => x.name);
  const lines = [`${p.products.length} etichete de raft (21 pe pagina A4).`];
  if (badEan.length) lines.push(`Cod EAN invalid (cifra de control gresita), afisat fara cod de bare: ${badEan.join(", ")}.`);
  if (noUnit.length) {
    lines.push(`Fara pret unitar (lipseste cantitatea, de ex. unit_quantity 250 + unit_label "g"): ${noUnit.join(", ")}.`);
  }
  return lines.join("\n");
}
