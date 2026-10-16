// Dispoziție de plată/încasare către casierie (form 14-4-4, OMFP 2634/2015).

import type { CashOrderPayload, DraftRecord } from "./types.ts";
import { amountInRomanianWords } from "../unelte/romanian-amount-words.ts";
import { escapeHtml, fmtMoney, formatDate, renderShell } from "./page.ts";

export interface RenderOptions {
  local?: boolean;
  pageSize?: "A4" | "A5";
  /** Empty form for hand filling, laid out like the official model (front, then beneficiary and cashier blocks). */
  blank?: boolean;
}

function cashOrderCss(): string {
  return `
.cash-order .dir-row{text-align:center;font-size:11pt}
.cash-order .lbl,.cashier .lbl{width:28%;font-weight:700;background:#f8fafc}
.cash-order-back{margin-top:8mm;break-before:page}
.back-title{font-size:11pt;margin:0 0 3mm;text-align:center}
table.cashier{margin-top:8mm}
.sig-line{min-height:10mm}
.sheet.a5{max-width:148mm;padding:8mm}
.sheet.a5 h1.doc-title{font-size:12pt}
.sheet.a5 table.doc{font-size:8pt}
`;
}

/** Placeholder payload for the blank form; no field of it is printed when `blank` is set. */
export const BLANK_CASH_ORDER: CashOrderPayload = {
  company: "",
  doc_number: "",
  date: "",
  direction: "plata",
  person_name: "",
  amount: 0,
  purpose: "",
};

const BLANK_CSS = `
.blank .doc-meta{justify-content:flex-start}
.blank-line{display:inline-block;min-width:60mm;border-bottom:1px dotted #000;height:1.1em;vertical-align:bottom}
.blank-line.s{min-width:22mm}
.blank-line.m{min-width:40mm}
.blank .cash-order td,.blank .cashier td,.blank .back td{height:9mm}
.blank .cash-order td.tall{height:16mm}
.blank .cash-order .dir-row{height:auto;padding:2mm}
.blank .dir-row .dir-sub{display:block;margin-top:2mm;font-weight:400}
.blank .unit{white-space:nowrap}
.blank .cash-order .lbl{width:22%}
.blank .cash-order td.words{width:36%}
.blank table.signs-table{margin-top:5mm}
.blank table.signs-table th{width:auto}
.blank table.signs-table td{height:16mm}
.blank table.signs-table .side{width:16%;font-weight:700;background:#f8fafc;text-align:center}
.blank .back .lbl{width:28%;font-weight:700;background:#f8fafc}
.blank .cash-order-back{break-before:auto;margin-top:6mm}
.sheet.a5.blank .cash-order-back{break-before:page}
.sheet.a5.blank .cash-order td,.sheet.a5.blank .cashier td,.sheet.a5.blank .back td{height:7mm}
.sheet.a5.blank .cash-order td.tall,.sheet.a5.blank table.signs-table td{height:11mm}
.sheet.a5.blank .back-title{font-size:9.5pt}
`;

/** Body of the blank 14-4-4 form, in the order of the model in Anexa nr. 3 to OMFP nr. 2.634/2015. */
function blankBody(): string {
  return `<h1 class="doc-title">Dispoziție de plată/încasare către casierie</h1>
<p class="doc-code">Cod formular 14-4-4 (OMFP nr. 2.634/2015, Anexa nr. 3)</p>
<div class="doc-meta">
<span><b>Entitatea:</b> <span class="blank-line"></span></span>
</div>
<table class="doc cash-order">
<tbody>
<tr><td colspan="4" class="dir-row"><b>DISPOZIȚIE DE*) <span class="blank-line m"></span> CĂTRE CASIERIE</b><span class="dir-sub">nr. <span class="blank-line s"></span> din <span class="blank-line m"></span></span></td></tr>
<tr>
<td class="lbl">Numele și prenumele</td>
<td colspan="3"></td>
</tr>
<tr>
<td class="lbl">Funcția (calitatea)</td>
<td colspan="3"></td>
</tr>
<tr>
<td class="lbl">Suma (în cifre)</td>
<td class="num unit">lei</td>
<td class="lbl">Suma (în litere)</td>
<td></td>
</tr>
<tr>
<td class="lbl">Scopul încasării/plății</td>
<td colspan="3" class="tall"></td>
</tr>
</tbody>
</table>
<table class="doc signs-table">
<tbody>
<tr><th class="side" rowspan="2">Semnătura</th><th>Conducătorul entității</th><th>Compartiment financiar-contabil</th></tr>
<tr><td></td><td></td></tr>
</tbody>
</table>
<p class="note">*) Se va înscrie „ÎNCASARE” sau „PLATĂ”, după caz.</p>
<section class="cash-order-back">
<h2 class="back-title">Date suplimentare privind beneficiarul sumei</h2>
<p class="note muted">Se completează numai pentru plăți.</p>
<table class="doc back">
<tbody>
<tr><td class="lbl">Actul de identitate</td><td colspan="3"></td></tr>
<tr><td class="lbl">Seria</td><td></td><td class="lbl">nr.</td><td></td></tr>
<tr><td class="lbl">Am primit suma de</td><td class="num unit" colspan="3">lei (în cifre)</td></tr>
<tr><td class="lbl">Data</td><td colspan="3"></td></tr>
<tr><td class="lbl">Semnătura</td><td class="sig-line" colspan="3"></td></tr>
</tbody>
</table>
</section>
<table class="doc cashier">
<tbody>
<tr><td colspan="2" class="ctr"><b>CASIER</b></td></tr>
<tr>
<td class="lbl">Plătit/încasat suma de</td>
<td class="num unit">lei (în cifre)</td>
</tr>
<tr>
<td class="lbl">Data</td>
<td></td>
</tr>
<tr>
<td class="lbl">Semnătura</td>
<td class="sig-line"></td>
</tr>
</tbody>
</table>`;
}

function kindTitle(p: CashOrderPayload): string {
  return p.direction === "incasare" ? "ÎNCASARE" : "PLATĂ";
}

export function renderCashOrder(p: CashOrderPayload, draft: DraftRecord, opts: RenderOptions = {}): string {
  const pageSize = opts.pageSize ?? "A4";
  if (opts.blank) {
    return renderShell({
      kind: "cash_order",
      title: "Dispoziție de plată/încasare (model necompletat)",
      expiresAt: draft.expires_at,
      body: blankBody(),
      css: cashOrderCss() + BLANK_CSS,
      margin: pageSize === "A5" ? "8mm" : "10mm",
      pageSize,
      sheetClass: pageSize === "A5" ? "a5 blank" : "blank",
      local: opts.local,
    });
  }
  const dir = kindTitle(p);
  const amountWords = p.amount_words?.trim() || amountInRomanianWords(p.amount);
  const dateFmt = formatDate(p.date) ?? p.date;
  const beneficiaryBlock =
    p.direction === "plata"
      ? `<section class="cash-order-back">
<h2 class="back-title">Date suplimentare privind beneficiarul sumei</h2>
<p class="note muted">Se completează numai pentru plăți (Anexa nr. 3 la OMFP nr. 2.634/2015, model 14-4-4).</p>
<table class="doc back">
<tbody>
<tr><td class="lbl">Actul de identitate</td><td colspan="3">${escapeHtml(p.beneficiary_id_type ?? "")}</td></tr>
<tr><td class="lbl">Seria</td><td>${escapeHtml(p.beneficiary_id_series ?? "")}</td><td class="lbl">nr.</td><td>${escapeHtml(p.beneficiary_id_number ?? "")}</td></tr>
<tr><td class="lbl">Am primit suma de</td><td class="num" colspan="3">${escapeHtml(fmtMoney(p.amount))} lei (în cifre)</td></tr>
<tr><td class="lbl">Data</td><td colspan="3">${escapeHtml(p.beneficiary_date ? formatDate(p.beneficiary_date) ?? p.beneficiary_date : "")}</td></tr>
<tr><td class="lbl">Semnătura beneficiarului</td><td class="sig-line" colspan="3"></td></tr>
</tbody>
</table>
</section>`
      : "";

  const body = `<h1 class="doc-title">Dispoziție de ${escapeHtml(dir)} către casierie</h1>
<p class="doc-code">Cod formular 14-4-4 (OMFP nr. 2.634/2015)</p>
<div class="doc-meta">
<span><b>Entitatea:</b> ${escapeHtml(p.company)}</span>
${p.company_tax_id ? `<span><b>Cod de identificare fiscală:</b> ${escapeHtml(p.company_tax_id)}</span>` : ""}
<span><b>Nr.:</b> ${escapeHtml(p.doc_number)}</span>
<span><b>Data:</b> ${escapeHtml(dateFmt)}</span>
</div>
<table class="doc cash-order">
<tbody>
<tr><td colspan="4" class="dir-row"><b>DISPOZIȚIE DE ${escapeHtml(dir)} CĂTRE CASIERIE</b></td></tr>
<tr>
<td class="lbl">Numele și prenumele</td>
<td colspan="3">${escapeHtml(p.person_name)}</td>
</tr>
<tr>
<td class="lbl">Funcția (calitatea)</td>
<td colspan="3">${escapeHtml(p.person_role ?? "")}</td>
</tr>
<tr>
<td class="lbl">Suma (în cifre)</td>
<td class="num">${escapeHtml(fmtMoney(p.amount))} lei</td>
<td class="lbl">Suma (în litere)</td>
<td>${escapeHtml(amountWords)}</td>
</tr>
<tr>
<td class="lbl">Scopul ${p.direction === "incasare" ? "încasării" : "plății"}</td>
<td colspan="3">${escapeHtml(p.purpose)}</td>
</tr>
</tbody>
</table>
<div class="signs cash-order-signs">
<div>Conducătorul entității<span>Nume, prenume, semnătura</span></div>
<div>Compartiment financiar-contabil<span>Nume, prenume, semnătura</span></div>
</div>
<table class="doc cashier">
<tbody>
<tr><td colspan="2" class="ctr"><b>CASIER</b></td></tr>
<tr>
<td class="lbl">Plătit/încasat suma de</td>
<td class="num">${escapeHtml(fmtMoney(p.amount))} lei (în cifre)</td>
</tr>
<tr>
<td class="lbl">Data</td>
<td></td>
</tr>
<tr>
<td class="lbl">Semnătura</td>
<td class="sig-line"></td>
</tr>
</tbody>
</table>
${beneficiaryBlock}`;

  const extraCss = cashOrderCss();

  return renderShell({
    kind: "cash_order",
    title: `Dispoziție de ${dir.toLowerCase()} nr. ${p.doc_number}`,
    expiresAt: draft.expires_at,
    body,
    css: extraCss,
    margin: pageSize === "A5" ? "8mm" : "10mm",
    pageSize,
    sheetClass: pageSize === "A5" ? "a5" : undefined,
    local: opts.local,
  });
}
