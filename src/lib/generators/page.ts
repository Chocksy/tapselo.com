// Shared HTML shell for /g/{id} documents: screen-only banner with the print button,
// A4 print CSS, printed "Generat cu tapselo.com" footer, screen-only expiry + abuse line
// (omitted for documents built locally by the /unelte tools).
// Pure (no DOM, no fetch). Every user text goes through escapeHtml.

import { escapeHtml, formatDate } from "../offers-render.ts";
import { trackedUrl } from "../mcp/links.ts";

export { escapeHtml, formatDate };

export const ABUSE_EMAIL = "contact@tapselo.com";

/** The one inline script on the page. CSP allows it by hash (tests/gen-render.test.ts checks the hash). */
export const PRINT_SCRIPT = `document.getElementById("print-btn").addEventListener("click",function(){window.print()});`;
export const PRINT_SCRIPT_HASH = "sha256-i3/Q14N9wysjWJxoM138BNHrMkyP1j5Pdq3FAsy98OI=";

export const KIND_TITLES: Record<string, string> = {
  flyer: "Flyer cu oferte",
  labels: "Etichete de raft",
  nir: "Notă de recepție și constatare de diferențe (NIR)",
  recipe: "Fișă tehnică",
  cashbook: "Registrul de casă",
};

// ---------- number formatting (Romanian: 1.234,56) ----------

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1234.5 -> "1.234,50" */
export function fmtMoney(n: number): string {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 && Number(n.toFixed(2)) !== 0 ? "-" : ""}${group(i)},${d}`;
}

/** 1234.5 -> "1.234,50 lei" */
export function fmtLei(n: number): string {
  return `${fmtMoney(n)} lei`;
}

/** Up to 3 decimals, no trailing zeros: 1.5 -> "1,5", 2 -> "2". */
export function fmtQty(n: number, decimals = 3): string {
  const s = Number(n.toFixed(decimals)).toString();
  const [i, d] = s.replace("-", "").split(".");
  return `${n < 0 ? "-" : ""}${group(i)}${d ? `,${d}` : ""}`;
}

// ---------- shell pieces (also used by the flyer, which keeps the offers page look) ----------

/** Documents generated in the visitor's browser (/unelte) instead of a stored /g/{id} draft. */
function shellHref(kind: string, local: boolean): string {
  return local
    ? `https://tapselo.com/?utm_source=unelte&utm_medium=document&utm_campaign=g_${encodeURIComponent(kind)}`
    : trackedUrl("/", `g_${kind}`);
}

export function bannerHtml(kind: string, local = false): string {
  const href = shellHref(kind, local);
  return `<div class="g-banner no-print" role="note">
<p>Document creat gratuit cu Tapselo, casa de marcat pentru magazine mici. <a href="${escapeHtml(href)}">Află mai mult</a></p>
<button type="button" id="print-btn" class="g-print">Printează / Salvează PDF</button>
</div>`;
}

export function footerHtml(kind: string, expiresAt: string | null | undefined, local = false): string {
  const href = shellHref(kind, local);
  const exp = formatDate(expiresAt);
  const abuse = local
    ? ""
    : `\n<p class="g-abuse no-print">Pagină creată de un utilizator.${exp ? ` Expiră pe ${escapeHtml(exp)}.` : ""} Raportează abuz: <!--email_off--><a href="mailto:${ABUSE_EMAIL}">${ABUSE_EMAIL}</a><!--/email_off--></p>`;
  return `<div class="g-footer">
<p class="g-made">Generat cu <a href="${escapeHtml(href)}">tapselo.com</a></p>${abuse}
</div>`;
}

export const SCRIPT_TAG = `<script>${PRINT_SCRIPT}</script>`;

/** Banner, footer and print rules; safe next to the offers page CSS (g- prefixed classes). */
export const CHROME_CSS = `
.g-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.5rem 1rem;padding:.625rem 1rem;background:#0f172a;color:#e2e8f0;font:500 .9375rem/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
.g-banner p{margin:0}
.g-banner a{color:#facc15;font-weight:700}
.g-print{font:inherit;font-weight:800;padding:.5rem 1rem;border:0;border-radius:.5rem;background:#facc15;color:#0f172a;cursor:pointer}
.g-print:hover{background:#fde047}
.g-footer{margin:1.5rem 0 0;text-align:center;font:400 .8125rem/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#64748b}
.g-footer p{margin:.25rem 0}
.g-made a{color:#0f172a;font-weight:700;text-decoration:none}
.g-abuse a{color:inherit}
@media print{.no-print{display:none !important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.g-footer{margin-top:4mm}}
`;

const DOC_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#e2e8f0;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.35}
.sheet{background:#fff;margin:1.5rem auto;padding:12mm;max-width:210mm;box-shadow:0 2px 12px rgba(15,23,42,.18)}
.sheet.landscape{max-width:297mm}
h1.doc-title{margin:0 0 3mm;font-size:15pt;text-align:center;text-transform:uppercase;letter-spacing:.02em}
.doc-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2mm 8mm;margin:0 0 4mm;font-size:9.5pt}
.doc-meta b{font-weight:700}
table.doc{width:100%;border-collapse:collapse;font-size:8.5pt}
table.doc th,table.doc td{border:1px solid #000;padding:1mm 1.5mm;vertical-align:middle}
table.doc th{background:#f1f5f9;font-weight:700;text-align:center}
table.doc tfoot td{font-weight:700;background:#f8fafc}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ctr{text-align:center}
.muted{color:#475569}
.note{margin:3mm 0 0;font-size:9pt}
.warn{margin:3mm 0 0;padding:2mm 3mm;border:1px solid #b91c1c;border-left-width:3mm;color:#7f1d1d;background:#fef2f2;font-size:9.5pt}
.signs{display:flex;justify-content:space-between;gap:10mm;margin-top:10mm;font-size:9.5pt}
.signs div{flex:1}
.signs span{display:block;margin-top:9mm;border-top:1px solid #000;padding-top:1mm;font-size:8pt;color:#475569}
thead{display:table-header-group}
tr{break-inside:avoid}
@media (max-width:820px){.sheet{margin:0;padding:5mm;box-shadow:none;overflow-x:auto}}
@media print{body{background:#fff}.sheet{margin:0;padding:0;max-width:none;box-shadow:none}}
`;

export interface ShellOptions {
  kind: string;
  title: string;
  expiresAt: string | null | undefined;
  /** Trusted HTML of the document (caller escapes every text). */
  body: string;
  /** Extra trusted CSS for this kind. */
  css?: string;
  landscape?: boolean;
  /** Page margin for @page, default 10mm. */
  margin?: string;
  /** Built in the browser by /unelte: no abuse line, web-tool UTM tags. */
  local?: boolean;
}

export function renderShell(o: ShellOptions): string {
  const pageRule = `@page{size:A4${o.landscape ? " landscape" : ""};margin:${o.margin ?? "10mm"}}`;
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(o.title)} - Tapselo</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<style>${pageRule}${DOC_CSS}${CHROME_CSS}${o.css ?? ""}</style>
</head>
<body data-kind="${escapeHtml(o.kind)}">
${bannerHtml(o.kind, o.local)}
<main class="sheet${o.landscape ? " landscape" : ""}">
${o.body}
${footerHtml(o.kind, o.expiresAt, o.local)}
</main>
${SCRIPT_TAG}
</body>
</html>
`;
}

/** Unknown, expired or broken draft. */
export function renderGeneratedNotFound(): string {
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Documentul nu a fost găsit - Tapselo</title>
<meta name="robots" content="noindex, nofollow" />
<style>${DOC_CSS}${CHROME_CSS}.sheet{text-align:center;font-size:12pt}</style>
</head>
<body>
<main class="sheet">
<h1 class="doc-title">Documentul nu a fost găsit</h1>
<p>Linkul nu există sau documentul a expirat (documentele se păstrează 30 de zile).</p>
<p><a href="${escapeHtml(trackedUrl("/", "g_not_found"))}">Mergi pe tapselo.com</a></p>
</main>
</body>
</html>
`;
}
