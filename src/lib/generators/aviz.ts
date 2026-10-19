// Aviz de însoțire a mărfii (form 14-3-6A, OMFP 2634/2015), A4 or A5 portrait.
// Laid out like the model in Anexa nr. 3: furnizor / cumpărător blocks, number and date,
// lines (specificația, U/M, cantitatea livrată, prețul unitar fără TVA, valoarea), then the
// signature, expedition data, TOTAL and receipt boxes. The mention required by the Norme
// specifice ("Fără factură", "Pentru prelucrare la terți" or the reason) prints under the title.
// Blank mode prints the same layout empty, for hand filling.

import type { AvizLine, AvizParty, AvizPayload, DraftRecord } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, fmtQty, formatDate, renderShell } from "./page.ts";

export interface RenderOptions {
  local?: boolean;
  pageSize?: "A4" | "A5";
  /** Empty form for hand filling; no payload field is printed. */
  blank?: boolean;
}

/** Mentions the Norme specifice (Anexa nr. 2, cod 14-3-6A) ask for, by situation. */
export const AVIZ_MENTIONS = {
  transfer: "Fără factură",
  gratuit: "Fără factură",
  prelucrare: "Pentru prelucrare la terți",
} as const;

/** Placeholder payload for the blank form. */
export const BLANK_AVIZ: AvizPayload = {
  supplier: { name: "" },
  buyer: { name: "" },
  doc_number: "",
  date: "",
  lines: [],
};

/** Empty rows printed on the blank form. */
export const BLANK_ROWS = { A4: 14, A5: 6 } as const;

export function avizLineValue(l: AvizLine): number | null {
  return l.unit_price === undefined || l.unit_price === null ? null : roundMoney(l.quantity * l.unit_price);
}

/** Sum of the line values; null when any line has no price (values kept in another document). */
export function avizTotal(lines: AvizLine[]): number | null {
  let total = 0;
  for (const l of lines) {
    const v = avizLineValue(l);
    if (v === null) return null;
    total += v;
  }
  return lines.length ? roundMoney(total) : null;
}

const CSS = `
.aviz .parties{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:0 0 4mm;font-size:9pt}
.aviz .party p{margin:0 0 1mm}
.aviz .party .who{font-size:10pt}
.aviz .title-box{margin:0 auto 3mm;padding:2mm 6mm;border:1px solid #000;width:max-content;min-width:70mm;font-size:9.5pt}
.aviz .title-box p{margin:1mm 0}
.aviz .mention{margin:0 0 3mm;text-align:center;font-size:10pt;font-weight:700}
.aviz table.lines td{height:6mm}
.aviz table.lines .crt{width:8%}
.aviz table.lines .um{width:8%}
.aviz table.lines th.idx{font-weight:400;background:#fff}
.aviz table.foot{margin-top:0;border-top:0}
.aviz table.foot td{vertical-align:top;font-size:8.5pt}
.aviz table.foot .sig{width:26%}
.aviz table.foot .exp{width:40%;line-height:1.6}
.aviz table.foot .exp p{margin:0}
.aviz table.foot .tot{font-weight:700;text-align:center;vertical-align:middle;width:12%}
.aviz table.foot .num.tot{width:22%;text-align:right}
.aviz table.foot .recv{height:24mm}
.aviz .dots{display:inline-block;min-width:18mm;border-bottom:1px dotted #000;height:1em;vertical-align:bottom}
.aviz .dots.l{min-width:34mm}
.aviz .party .dots{min-width:40mm}
.sheet.a5{max-width:148mm;padding:8mm}
.sheet.a5 h1.doc-title{font-size:12pt}
.sheet.a5 .aviz .parties{font-size:7.5pt;gap:4mm}
.sheet.a5 .aviz .party .who{font-size:8pt}
.sheet.a5 .aviz table.doc{font-size:7.5pt}
.sheet.a5 .aviz table.foot td{font-size:7pt}
.sheet.a5 .aviz table.lines td{height:5mm}
.sheet.a5 .aviz .title-box{font-size:8pt;min-width:56mm}
.sheet.a5 .aviz .party .dots{min-width:22mm}
.sheet.a5 .aviz .dots{min-width:10mm}
.sheet.a5 .aviz .dots.l{min-width:22mm}
.sheet.a5 .aviz .mention{font-size:8.5pt;margin-bottom:2mm}
.sheet.a5 .aviz .note{font-size:7pt;margin-top:2mm}
.sheet.a5 .aviz table.foot .exp{line-height:1.45}
.sheet.a5 .aviz table.foot .recv{height:16mm}
.sheet.a5 .aviz .parties p{margin-bottom:.6mm}
`;

/** Escaped value, or a dotted line to fill by hand when empty. */
function val(v: string | undefined, blank: boolean, cls = ""): string {
  const s = (v ?? "").trim();
  if (blank || !s) return `<span class="dots${cls ? ` ${cls}` : ""}"></span>`;
  return escapeHtml(s);
}

function partyHtml(role: "Furnizor" | "Cumpărător", p: AvizParty, blank: boolean): string {
  const capital = !blank && p.share_capital?.trim() ? `<p>Capital social: ${escapeHtml(p.share_capital.trim())}</p>` : "";
  return `<div class="party">
<p class="who"><b>${role}:</b> ${val(p.name, blank)}</p>
<p class="muted">(denumirea, forma juridică)</p>
<p>Nr. de înmatriculare în Registrul comerțului/anul: ${val(p.trade_register, blank)}</p>
<p>Cod de identificare fiscală: ${val(p.tax_id, blank)}</p>
${capital}<p>Sediul (localitatea, str., nr.): ${val(p.address, blank)}</p>
<p>Județul: ${val(p.county, blank)}</p>
</div>`;
}

function linesHtml(p: AvizPayload, blank: boolean, rows: number): string {
  const body = blank
    ? Array.from({ length: rows }, () => `<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("\n")
    : p.lines
        .map((l, i) => {
          const v = avizLineValue(l);
          return `<tr>
<td class="ctr">${i + 1}</td>
<td>${escapeHtml(l.name)}</td>
<td class="ctr">${escapeHtml(l.unit)}</td>
<td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
<td class="num">${l.unit_price === undefined || l.unit_price === null ? "" : escapeHtml(fmtMoney(l.unit_price))}</td>
<td class="num">${v === null ? "" : escapeHtml(fmtMoney(v))}</td>
</tr>`;
        })
        .join("\n");
  return `<table class="doc lines">
<thead>
<tr><th class="crt">Nr. crt.</th><th>Specificația (produse, ambalaje etc.)</th><th class="um">U/M</th><th>Cantitatea livrată</th><th>Prețul unitar (fără TVA) - lei -</th><th>Valoarea - lei -</th></tr>
<tr><th class="idx">0</th><th class="idx">1</th><th class="idx">2</th><th class="idx">3</th><th class="idx">4</th><th class="idx">5</th></tr>
</thead>
<tbody>
${body}
</tbody>
</table>`;
}

function footHtml(p: AvizPayload, blank: boolean): string {
  const total = blank ? null : avizTotal(p.lines);
  const date = blank || !p.dispatch_date ? "" : formatDate(p.dispatch_date) ?? p.dispatch_date;
  return `<table class="doc foot">
<tbody>
<tr>
<td class="sig" rowspan="2"><b>Semnătura reprezentant furnizor</b></td>
<td class="exp" rowspan="2">
<p><b>Date privind expediția</b></p>
<p>Numele delegatului: ${val(p.delegate_name, blank, "l")}</p>
<p>Cartea de identitate seria ${val(p.delegate_id_series, blank)} nr. ${val(p.delegate_id_number, blank)}</p>
<p>eliberat/ă ${val(p.delegate_id_issuer, blank, "l")}</p>
<p>Mijlocul de transport ${val(p.vehicle, blank)} nr. ${val(p.vehicle_number, blank)}</p>
<p>Expedierea s-a efectuat în prezența noastră la data de ${val(date, blank)} ora ${val(p.dispatch_time, blank)}</p>
<p>Semnăturile <span class="dots l"></span></p>
</td>
<td class="tot">TOTAL</td>
<td class="num tot">${total === null ? "" : escapeHtml(fmtMoney(total))}</td>
</tr>
<tr><td class="recv" colspan="2"><b>Semnătura de primire</b></td></tr>
</tbody>
</table>`;
}

export function renderAviz(p: AvizPayload, draft: DraftRecord, opts: RenderOptions = {}): string {
  const pageSize = opts.pageSize ?? "A4";
  const blank = opts.blank ?? false;
  const date = blank || !p.date ? "" : formatDate(p.date) ?? p.date;
  const mention = blank
    ? `<p class="mention">Mențiune: <span class="dots l"></span></p>`
    : p.mention?.trim()
      ? `<p class="mention">${escapeHtml(p.mention.trim())}</p>`
      : "";
  const pricesElsewhere =
    !blank && p.lines.length > 0 && p.lines.every((l) => l.unit_price === undefined || l.unit_price === null)
      ? `<p class="note muted">Prețul unitar și valoarea nu sunt înscrise pe aviz; se regăsesc în alt document justificativ.</p>`
      : "";
  const body = `<div class="aviz">
<div class="parties">
${partyHtml("Furnizor", p.supplier, blank)}
${partyHtml("Cumpărător", p.buyer, blank)}
</div>
<h1 class="doc-title">Aviz de însoțire a mărfii</h1>
<div class="title-box">
<p><b>Nr.</b> ${val(p.doc_number, blank)}</p>
<p><b>Data</b> (ziua, luna, anul) ${val(date, blank)}</p>
</div>
${mention}
${linesHtml(p, blank, BLANK_ROWS[pageSize])}
${footHtml(p, blank)}
${pricesElsewhere}
<p class="note muted">Cod formular 14-3-6A (OMFP nr. 2.634/2015, Anexa nr. 3)</p>
</div>`;
  return renderShell({
    kind: "aviz",
    title: blank ? "Aviz de însoțire a mărfii (model necompletat)" : `Aviz de însoțire a mărfii nr. ${p.doc_number}`,
    expiresAt: draft.expires_at,
    body,
    css: CSS,
    margin: pageSize === "A5" ? "8mm" : "10mm",
    pageSize,
    sheetClass: pageSize === "A5" ? "a5" : undefined,
    local: opts.local,
  });
}
