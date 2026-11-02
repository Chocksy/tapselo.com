// Declarație de conformitate voluntară pentru produse alimentare — print/PDF in browser (/unelte).

import type { DraftRecord, FoodConformityPayload } from "./types.ts";
import { ALLERGENS_1169_ANEXA_II } from "../unelte/declaratie-conformitate-alimente.ts";
import { escapeHtml, formatDate, renderShell } from "./page.ts";

export interface RenderOptions {
  local?: boolean;
}

const CSS = `
.fcd{max-width:180mm;margin:0 auto;font-size:10.5pt;line-height:1.45}
.fcd h1.doc-title{font-size:13pt;margin-bottom:4mm}
.fcd .voluntary{margin:0 0 4mm;padding:2mm 3mm;border:1px solid #64748b;background:#f8fafc;font-size:9pt;color:#334155}
.fcd p{margin:0 0 2.5mm}
.fcd .block{margin:3mm 0}
.fcd .label{font-weight:700}
.fcd ul{margin:1mm 0 2mm;padding-left:5mm}
.fcd .sign{margin-top:8mm}
.fcd .sign-line{margin-top:14mm;border-top:1px solid #000;width:70mm;padding-top:1mm;font-size:9pt;color:#475569}
`;

function allergenLabels(ids: string[]): string[] {
  const set = new Set(ids);
  return ALLERGENS_1169_ANEXA_II.filter((a) => set.has(a.id)).map((a) => a.label);
}

function shelfLifeLabel(p: FoodConformityPayload): string {
  const d = p.shelf_life_date ? formatDate(p.shelf_life_date) ?? p.shelf_life_date : "………………";
  return p.shelf_life_kind === "dlc" ? `Data limită de consum: ${d}` : `Data durabilității minimă: ${d}`;
}

function field(label: string, value: string | undefined): string {
  const v = (value ?? "").trim();
  return `<p><span class="label">${escapeHtml(label)}:</span> ${v ? escapeHtml(v) : "………………"}</p>`;
}

export function foodConformityPlainLines(p: FoodConformityPayload): string[] {
  const allergens = allergenLabels(p.allergen_ids);
  const lines = [
    "DECLARAȚIE DE CONFORMITATE (document voluntar)",
    "",
    `Producător: ${p.producer_name.trim()}`,
  ];
  if (p.producer_tax_id?.trim()) lines.push(`CUI: ${p.producer_tax_id.trim()}`);
  if (p.producer_address?.trim()) lines.push(`Sediu / punct de lucru: ${p.producer_address.trim()}`);
  if (p.producer_sanitary_auth?.trim()) lines.push(`Nr. înregistrare / autorizare sanitar-veterinară: ${p.producer_sanitary_auth.trim()}`);
  lines.push("", `Produs: ${p.product_name.trim()}`);
  if (p.product_code?.trim()) lines.push(`Cod intern: ${p.product_code.trim()}`);
  if (p.batch_lot?.trim()) lines.push(`Lot: ${p.batch_lot.trim()}`);
  if (p.manufacture_date?.trim()) lines.push(`Data fabricației: ${formatDate(p.manufacture_date) ?? p.manufacture_date}`);
  lines.push("", "Ingrediente:", p.ingredients.trim());
  lines.push("", allergens.length ? `Alergeni (conform Reg. (UE) 1169/2011, anexa II): ${allergens.join("; ")}` : "Alergeni (anexa II): nu sunt declarați în produs.");
  lines.push(shelfLifeLabel(p));
  if (p.storage_conditions?.trim()) lines.push(`Condiții de păstrare: ${p.storage_conditions.trim()}`);
  if (p.quantity_packaging?.trim()) lines.push(`Cantitate / ambalare: ${p.quantity_packaging.trim()}`);
  lines.push("", `Document tehnic normativ de referință: ${p.reference_document.trim()}`);
  lines.push(
    "",
    "Declar pe propria răspundere că produsul descris mai sus este conform cu documentul tehnic normativ indicat.",
  );
  if (p.buyer_name?.trim()) lines.push("", `Destinatar (cumpărător): ${p.buyer_name.trim()}`);
  const placeDate = [p.place?.trim(), p.declaration_date ? formatDate(p.declaration_date) ?? p.declaration_date : ""]
    .filter(Boolean)
    .join(", ");
  if (placeDate) lines.push("", placeDate);
  if (p.signatory_name?.trim() || p.signatory_role?.trim()) {
    lines.push("", `${p.signatory_name?.trim() ?? ""}${p.signatory_role?.trim() ? `, ${p.signatory_role.trim()}` : ""}`);
  }
  lines.push("", "Semnătură: ________________________________");
  return lines;
}

export function renderFoodConformityDeclaration(
  p: FoodConformityPayload,
  draft: DraftRecord,
  opts: RenderOptions = {},
): string {
  const allergens = allergenLabels(p.allergen_ids);
  const allergenBlock = allergens.length
    ? `<ul>${allergens.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
    : `<p class="muted">Nu sunt declarați alergeni pentru acest produs.</p>`;

  const body = `<div class="fcd">
<p class="voluntary">Document voluntar — nu este o declarație CE și nu înlocuiește etichetarea obligatorie.</p>
<h1 class="doc-title">Declarație de conformitate</h1>
<div class="block">
${field("Producător", p.producer_name)}
${field("Cod de identificare fiscală", p.producer_tax_id)}
${field("Sediu / punct de lucru", p.producer_address)}
${field("Nr. înregistrare / autorizare sanitar-veterinară", p.producer_sanitary_auth)}
</div>
<div class="block">
${field("Produs", p.product_name)}
${field("Cod intern", p.product_code)}
${field("Lot", p.batch_lot)}
${field("Data fabricației", p.manufacture_date ? formatDate(p.manufacture_date) ?? p.manufacture_date : undefined)}
</div>
<div class="block">
<p class="label">Ingrediente:</p>
<p>${escapeHtml(p.ingredients.trim())}</p>
</div>
<div class="block">
<p class="label">Alergeni (Reg. (UE) 1169/2011, anexa II):</p>
${allergenBlock}
</div>
<div class="block">
<p>${escapeHtml(shelfLifeLabel(p))}</p>
${field("Condiții de păstrare", p.storage_conditions)}
${field("Cantitate / ambalare", p.quantity_packaging)}
</div>
<div class="block">
${field("Document tehnic normativ de referință", p.reference_document)}
</div>
<p>Subsemnatul/a, reprezentant al producătorului, declar pe propria răspundere că produsul descris este conform cu documentul tehnic normativ indicat.</p>
${p.buyer_name?.trim() ? field("Cumpărător (destinatar)", p.buyer_name) : ""}
${field("Loc", p.place)}
${field("Data", p.declaration_date ? formatDate(p.declaration_date) ?? p.declaration_date : undefined)}
<div class="sign">
${field("Nume", p.signatory_name)}
${field("Funcție", p.signatory_role)}
<p class="sign-line">Semnătură</p>
</div>
</div>`;

  return renderShell({
    kind: "food_conformity",
    title: `Declarație de conformitate — ${p.product_name.trim()}`,
    expiresAt: draft.expires_at,
    body,
    css: CSS,
    local: opts.local,
  });
}
