// Registrul de casa (kind "cashbook") for one day: opening balance, entries with a running
// balance, day totals, closing balance. Warns when the closing balance is over the 50,000 lei
// cash limit or when the balance goes negative.

import type { CashbookPayload, DraftRecord } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, formatDate, renderShell } from "./page.ts";

export const CASH_LIMIT = 50_000;

export interface CashbookCalc {
  /** Balance after each entry. */
  balances: number[];
  total_receipts: number;
  total_payments: number;
  closing_balance: number;
  over_limit: boolean;
  /** Index of the first entry after which the balance is below zero, or -1. */
  negative_at: number;
  warnings: string[];
}

export function cashbookCalc(p: Pick<CashbookPayload, "opening_balance" | "entries">): CashbookCalc {
  let bal = roundMoney(p.opening_balance);
  let rec = 0;
  let pay = 0;
  let negativeAt = -1;
  const balances = p.entries.map((e, i) => {
    rec = roundMoney(rec + (e.receipt ?? 0));
    pay = roundMoney(pay + (e.payment ?? 0));
    bal = roundMoney(bal + (e.receipt ?? 0) - (e.payment ?? 0));
    if (bal < 0 && negativeAt < 0) negativeAt = i;
    return bal;
  });
  const warnings: string[] = [];
  const over = bal > CASH_LIMIT;
  if (over) {
    warnings.push(
      `Soldul final (${fmtMoney(bal)} lei) depaseste plafonul de casa de ${fmtMoney(CASH_LIMIT)} lei. Depune diferenta la banca.`,
    );
  }
  if (negativeAt >= 0) {
    warnings.push(`Soldul devine negativ dupa inregistrarea ${negativeAt + 1}. Casa nu poate avea sold negativ; verifica sumele.`);
  }
  return { balances, total_receipts: rec, total_payments: pay, closing_balance: bal, over_limit: over, negative_at: negativeAt, warnings };
}

export function renderCashbook(p: CashbookPayload, draft: DraftRecord): string {
  const c = cashbookCalc(p);
  const rows = p.entries
    .map(
      (e, i) => `<tr>
<td class="ctr">${i + 1}</td>
<td>${escapeHtml(e.doc)}</td>
<td>${escapeHtml(e.description)}</td>
<td class="num">${e.receipt ? escapeHtml(fmtMoney(e.receipt)) : ""}</td>
<td class="num">${e.payment ? escapeHtml(fmtMoney(e.payment)) : ""}</td>
<td class="num">${escapeHtml(fmtMoney(c.balances[i]))}</td>
</tr>`,
    )
    .join("\n");
  const body = `<h1 class="doc-title">Registru de casa</h1>
<div class="doc-meta">
<span><b>Unitatea:</b> ${escapeHtml(p.company)}</span>
<span><b>Data:</b> ${escapeHtml(formatDate(p.date) ?? p.date)}</span>
<span><b>Valori in lei</b></span>
</div>
<table class="doc">
<thead><tr><th>Nr. crt.</th><th>Nr. act casa</th><th>Explicatii</th><th>Incasari</th><th>Plati</th><th>Sold</th></tr></thead>
<tbody>
<tr><td></td><td></td><td><b>Sold din ziua precedenta</b></td><td></td><td></td><td class="num"><b>${fmtMoney(p.opening_balance)}</b></td></tr>
${rows}
</tbody>
<tfoot>
<tr><td colspan="3">Total ziua</td><td class="num">${fmtMoney(c.total_receipts)}</td><td class="num">${fmtMoney(c.total_payments)}</td><td></td></tr>
<tr><td colspan="3">Sold final</td><td></td><td></td><td class="num">${fmtMoney(c.closing_balance)}</td></tr>
</tfoot>
</table>
${c.warnings.map((w) => `<p class="warn">${escapeHtml(w)}</p>`).join("\n")}
<div class="signs">
<div>Casier<span>Nume, prenume, semnatura</span></div>
<div>Compartiment financiar-contabil<span>Nume, prenume, semnatura</span></div>
</div>`;
  return renderShell({ kind: "cashbook", title: `Registru de casa ${formatDate(p.date) ?? p.date}`, expiresAt: draft.expires_at, body });
}

export function cashbookSummary(p: CashbookPayload): string {
  const c = cashbookCalc(p);
  return [
    `Registru de casa ${formatDate(p.date) ?? p.date}, ${p.company}: ${p.entries.length} inregistrari.`,
    `Sold initial ${fmtMoney(p.opening_balance)} lei, incasari ${fmtMoney(c.total_receipts)} lei, plati ${fmtMoney(c.total_payments)} lei, sold final ${fmtMoney(c.closing_balance)} lei.`,
    ...c.warnings.map((w) => `Atentie: ${w}`),
  ].join("\n");
}
