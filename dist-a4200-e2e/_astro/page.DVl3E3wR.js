import{e as o,f as d}from"./validate.BX1Fqqa9.js";const l="https://tapselo.com";function p(e,t,n="mcp"){const a=new URL(e,l);return a.searchParams.set("utm_source","ai-plugin"),a.searchParams.set("utm_medium",n),a.searchParams.set("utm_campaign",t),a.toString()}const i="contact@tapselo.com",f='document.getElementById("print-btn").addEventListener("click",function(){window.print()});';function s(e){return e.replace(/\B(?=(\d{3})+(?!\d))/g,".")}function g(e){const[t,n]=Math.abs(e).toFixed(2).split(".");return`${e<0&&Number(e.toFixed(2))!==0?"-":""}${s(t)},${n}`}function y(e){return`${g(e)} lei`}function k(e,t=3){const n=Number(e.toFixed(t)).toString(),[a,r]=n.replace("-","").split(".");return`${e<0?"-":""}${s(a)}${r?`,${r}`:""}`}function m(e,t){return t?`https://tapselo.com/?utm_source=unelte&utm_medium=document&utm_campaign=g_${encodeURIComponent(e)}`:p("/",`g_${e}`)}function u(e,t=!1){const n=m(e,t);return`<div class="g-banner no-print" role="note">
<p>Document creat gratuit cu Tapselo, casa de marcat pentru magazine mici. <a href="${o(n)}">Află mai mult</a></p>
<button type="button" id="print-btn" class="g-print">Printează / Salvează PDF</button>
</div>`}function b(e,t,n=!1){const a=m(e,n),r=d(t),c=n?"":`
<p class="g-abuse no-print">Pagină creată de un utilizator.${r?` Expiră pe ${o(r)}.`:""} Raportează abuz: <!--email_off--><a href="mailto:${i}">${i}</a><!--/email_off--></p>`;return`<div class="g-footer">
<p class="g-made">Generat cu <a href="${o(a)}">tapselo.com</a></p>${c}
</div>`}const h=`<script>${f}<\/script>`,x=`
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
`,w=`
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
`;function z(e){const t=`@page{size:A4${e.landscape?" landscape":""};margin:${e.margin??"10mm"}}`;return`<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${o(e.title)} - Tapselo</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<style>${t}${w}${x}${e.css??""}</style>
</head>
<body data-kind="${o(e.kind)}">
${u(e.kind,e.local)}
<main class="sheet${e.landscape?" landscape":""}">
${e.body}
${b(e.kind,e.expiresAt,e.local)}
</main>
${h}
</body>
</html>
`}export{y as a,k as b,g as f,z as r};
