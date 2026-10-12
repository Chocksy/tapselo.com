// Dispoziție de plată/încasare către casierie (form 14-4-4, OMFP 2634/2015).

import type { CashOrderPayload, DraftRecord } from "./types.ts";
import { amountInRomanianWords } from "../unelte/romanian-amount-words.ts";
import { escapeHtml, fmtMoney, formatDate, renderShell } from "./page.ts";

export interface RenderOptions {
  local?: boolean;
  pageSize?: "A4" | "A5";
}

function kindTitle(p: CashOrderPayload): string {
  return p.direction === "incasare" ? "ÎNCASARE" : "PLATĂ";
}

export function renderCashOrder(p: CashOrderPayload, draft: DraftRecord, opts: RenderOptions = {}): string {
  const pageSize = opts.pageSize ?? "A4";
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

  const extraCss = `
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
