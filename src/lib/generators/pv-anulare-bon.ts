// Dosar corectare/anulare bon fiscal după emitere (HG 479/2003, art. 36) — sesizare + decizie + checklist.

import type { DraftRecord, PvAnulareBonPayload, PvAnulareMotiv } from "./types.ts";
import { escapeHtml, formatDate, fmtMoney, renderShell } from "./page.ts";

export interface PvRenderOptions {
  local?: boolean;
  blank?: boolean;
}

export const BLANK_PV_ANULARE: PvAnulareBonPayload = {
  company: "",
  receipt_number: "",
  receipt_date: "",
  receipt_time: "",
  products_wrong: "",
  motiv: "altul",
  sesizare_name: "",
  sesizare_role: "",
  sesizare_date: "",
  decizie_name: "",
  decizie_role: "",
  decizie_date: "",
  checklist_nir_attached: false,
  checklist_nota_contabila: false,
};

const MOTIV_LABEL: Record<PvAnulareMotiv, string> = {
  pret_gresit: "preț greșit",
  cantitate: "cantitate greșită",
  produs: "produs greșit",
  altul: "alt motiv",
};

function pvCss(): string {
  return `
.pv h2.doc-section{margin:0 0 3mm;font-size:12pt;text-align:center;text-transform:uppercase}
.pv .lead{font-size:9.5pt;margin:0 0 4mm}
.pv .block{margin:0 0 3mm;font-size:10pt;text-align:justify}
.pv .meta table{width:100%;border-collapse:collapse;font-size:9pt;margin:0 0 4mm}
.pv .meta td{border:1px solid #000;padding:1.5mm 2mm;vertical-align:top}
.pv .meta .lbl{width:32%;font-weight:700;background:#f8fafc}
.pv .checklist{margin-top:6mm;padding:3mm;border:1px solid #000;font-size:9.5pt}
.pv .checklist li{margin:1.5mm 0}
.pv-page{break-before:page;margin-top:8mm}
.pv-blank .blank-line{display:inline-block;min-width:50mm;border-bottom:1px dotted #000;height:1.1em;vertical-align:bottom}
.pv-blank .blank-line.s{min-width:18mm}
.pv-blank .blank-line.m{min-width:32mm}
.pv-blank td{height:9mm}
`;
}

function motivText(p: PvAnulareBonPayload): string {
  const base = MOTIV_LABEL[p.motiv];
  if (p.motiv === "altul" && p.motiv_detail?.trim()) return p.motiv_detail.trim();
  if (p.motiv !== "altul" && p.motiv_detail?.trim()) return `${base}: ${p.motiv_detail.trim()}`;
  return base;
}

function blankBody(): string {
  return `<div class="pv pv-blank">
<h1 class="doc-title">Proces verbal / dosar corectare bon fiscal</h1>
<p class="doc-code">Practică de piață pentru dosarul art. 36, HG nr. 479/2003 — nu este un formular impus de lege</p>
<section>
<h2 class="doc-section">Sesizare scrisă (art. 36 lit. a))</h2>
<p class="block">Subsemnatul(a) <span class="blank-line m"></span>, având funcția de <span class="blank-line m"></span>, sesizez corectarea/anularea operațiunii înregistrate greșit, astfel:</p>
<table class="doc meta">
<tbody>
<tr><td class="lbl">Unitatea</td><td></td></tr>
<tr><td class="lbl">CUI</td><td></td></tr>
<tr><td class="lbl">Punct de lucru</td><td></td></tr>
<tr><td class="lbl">AMEF (model / serie)</td><td></td></tr>
<tr><td class="lbl">Bon fiscal nr.</td><td></td></tr>
<tr><td class="lbl">Data / ora:minut emiterii</td><td></td></tr>
<tr><td class="lbl">Valoare bon</td><td></td></tr>
<tr><td class="lbl">Produs(e) înregistrate greșit</td><td></td></tr>
<tr><td class="lbl">Motivul corectării/anulării</td><td></td></tr>
</tbody>
</table>
<p class="block">Semnătura: <span class="blank-line m"></span> &nbsp; Data: <span class="blank-line s"></span></p>
</section>
<section class="pv-page">
<h2 class="doc-section">Decizie scrisă de aprobare (art. 36 lit. b))</h2>
<p class="block">Aprob corectarea/anularea operațiunii greșit efectuate, conform sesizării de mai sus.</p>
<p class="block">Semnătura: <span class="blank-line m"></span> &nbsp; Funcția: <span class="blank-line m"></span> &nbsp; Data: <span class="blank-line s"></span></p>
</section>
<section class="pv-page">
<h2 class="doc-section">Checklist dosar (art. 36 lit. c) și d))</h2>
<ul class="checklist">
<li>☐ Copie de pe nota/notele de recepție și constatare de diferențe de la ultima inventariere, cu prețul cu amănuntul al produsului/produselor greșit înregistrate</li>
<li>☐ Nota de contabilitate care reflectă operațiunea efectuată</li>
</ul>
</section>
</div>`;
}

function filledBody(p: PvAnulareBonPayload): string {
  const dateBon = formatDate(p.receipt_date) ?? p.receipt_date;
  const sesDate = formatDate(p.sesizare_date) ?? p.sesizare_date;
  const decDate = formatDate(p.decizie_date) ?? p.decizie_date;
  const amount =
    p.receipt_amount != null && !Number.isNaN(p.receipt_amount)
      ? `${escapeHtml(fmtMoney(p.receipt_amount))} lei`
      : "—";
  const amef = [p.amef_model, p.amef_series].filter(Boolean).join(" / ") || "—";
  const optionalBon = p.correct_receipt_number?.trim()
    ? `<tr><td class="lbl">Bon corect emis ulterior (opțional)</td><td>${escapeHtml(p.correct_receipt_number.trim())}</td></tr>`
    : "";

  const checklist = `<ul class="checklist">
<li>${p.checklist_nir_attached ? "☑" : "☐"} Copie de pe nota/notele de recepție și constatare de diferențe de la ultima inventariere, cu prețul cu amănuntul al produsului/produselor greșit înregistrate (art. 36 lit. c))</li>
<li>${p.checklist_nota_contabila ? "☑" : "☐"} Nota de contabilitate care reflectă operațiunea efectuată (art. 36 lit. d))</li>
</ul>`;

  return `<div class="pv">
<h1 class="doc-title">Proces verbal / dosar corectare bon fiscal</h1>
<p class="doc-code">Practică de piață pentru dosarul prevăzut la art. 36 din HG nr. 479/2003 — denumirea „proces verbal” nu apare în textul legii</p>
<p class="lead"><b>${escapeHtml(p.company)}</b>${p.company_tax_id ? ` — CUI ${escapeHtml(p.company_tax_id)}` : ""}${p.workplace ? ` — ${escapeHtml(p.workplace)}` : ""}</p>

<section>
<h2 class="doc-section">Sesizare scrisă (art. 36 lit. a))</h2>
<p class="block">Subsemnatul(a) <b>${escapeHtml(p.sesizare_name)}</b>, având funcția de <b>${escapeHtml(p.sesizare_role)}</b>, sesizez corectarea sau anularea înregistrării operațiunii efectuate greșit, cu motivația și datele bonului fiscal de corectat, astfel:</p>
<table class="doc meta">
<tbody>
<tr><td class="lbl">AMEF (model / serie)</td><td>${escapeHtml(amef)}</td></tr>
<tr><td class="lbl">Bon fiscal nr.</td><td>${escapeHtml(p.receipt_number)}</td></tr>
<tr><td class="lbl">Data emiterii</td><td>${escapeHtml(dateBon)}</td></tr>
<tr><td class="lbl">Ora și minutul emiterii</td><td>${escapeHtml(p.receipt_time)}</td></tr>
<tr><td class="lbl">Valoare bon</td><td>${amount}</td></tr>
<tr><td class="lbl">Produs(e) înregistrate greșit</td><td>${escapeHtml(p.products_wrong)}</td></tr>
<tr><td class="lbl">Motivul corectării/anulării</td><td>${escapeHtml(motivText(p))}</td></tr>
${optionalBon}
</tbody>
</table>
<p class="block">Semnătura: _________________________ &nbsp; Data: ${escapeHtml(sesDate)}</p>
</section>

<section class="pv-page">
<h2 class="doc-section">Decizie scrisă de aprobare (art. 36 lit. b))</h2>
<p class="block">Subsemnatul(a) <b>${escapeHtml(p.decizie_name)}</b>, în calitate de <b>${escapeHtml(p.decizie_role)}</b>, aprob corectarea/anularea operațiunii greșit efectuate, conform sesizării de mai sus.</p>
<p class="block">Semnătura: _________________________ &nbsp; Data: ${escapeHtml(decDate)}</p>
</section>

<section class="pv-page">
<h2 class="doc-section">Checklist piese dosar</h2>
<p class="block muted">Completați și păstrați în dosar, alături de sesizare și decizie:</p>
${checklist}
</section>
</div>`;
}

/** Plain-text blocks for Word export (same content as PDF). */
export function pvAnulareBonDocxBlocks(p: PvAnulareBonPayload): string[] {
  const dateBon = formatDate(p.receipt_date) ?? p.receipt_date;
  const sesDate = formatDate(p.sesizare_date) ?? p.sesizare_date;
  const decDate = formatDate(p.decizie_date) ?? p.decizie_date;
  const amount =
    p.receipt_amount != null && !Number.isNaN(p.receipt_amount) ? `${fmtMoney(p.receipt_amount)} lei` : "—";
  const amef = [p.amef_model, p.amef_series].filter(Boolean).join(" / ") || "—";
  const lines: string[] = [
    "PROCES VERBAL / DOSAR CORECTARE BON FISCAL",
    "Practică de piață pentru dosarul art. 36, HG nr. 479/2003",
    "",
    p.company + (p.company_tax_id ? ` — CUI ${p.company_tax_id}` : "") + (p.workplace ? ` — ${p.workplace}` : ""),
    "",
    "SESIZARE SCRISĂ (art. 36 lit. a))",
    `Subsemnatul(a) ${p.sesizare_name}, funcția ${p.sesizare_role}, sesizez corectarea/anularea bonului fiscal nr. ${p.receipt_number} din ${dateBon}, ora ${p.receipt_time}, valoare ${amount}.`,
    `AMEF: ${amef}. Produse greșit înregistrate: ${p.products_wrong}. Motiv: ${motivText(p)}.`,
  ];
  if (p.correct_receipt_number?.trim()) {
    lines.push(`Bon corect emis ulterior (opțional): ${p.correct_receipt_number.trim()}`);
  }
  lines.push("", `Semnătură: _________________   Data: ${sesDate}`, "", "DECIZIE SCRISĂ DE APROBARE (art. 36 lit. b))");
  lines.push(
    `${p.decizie_name}, ${p.decizie_role}, aprob corectarea/anularea operațiunii greșit efectuate.`,
    `Semnătură: _________________   Data: ${decDate}`,
    "",
    "CHECKLIST DOSAR",
    `${p.checklist_nir_attached ? "[x]" : "[ ]"} Copie NIR de la ultima inventariere (art. 36 lit. c))`,
    `${p.checklist_nota_contabila ? "[x]" : "[ ]"} Notă contabilă (art. 36 lit. d))`,
  );
  return lines;
}

export function renderPvAnulareBon(
  p: PvAnulareBonPayload,
  draft: DraftRecord,
  opts: PvRenderOptions = {},
): string {
  const body = opts.blank ? blankBody() : filledBody(p);
  const title = opts.blank
    ? "Proces verbal anulare bon fiscal (model necompletat)"
    : `Proces verbal anulare bon ${p.receipt_number}`;
  return renderShell({
    kind: "pv_anulare_bon",
    title,
    expiresAt: draft.expires_at,
    body,
    css: pvCss(),
    margin: "12mm",
    pageSize: "A4",
    sheetClass: opts.blank ? "blank" : undefined,
    local: opts.local,
  });
}
