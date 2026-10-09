import{r as d,e as n,f as b}from"./validate.BX1Fqqa9.js";import{f as i,r as y,b as h}from"./page.DVl3E3wR.js";import{z as F,s as v}from"./browser.gElJkcYv.js";const T=5e4;function C(t){let a=d(t.opening_balance),o=0,e=0,s=-1;const c=t.entries.map((u,r)=>(o=d(o+(u.receipt??0)),e=d(e+(u.payment??0)),a=d(a+(u.receipt??0)-(u.payment??0)),a<0&&s<0&&(s=r),a)),l=[],m=a>T;return m&&l.push(`Soldul final (${i(a)} lei) depășește plafonul de casă de ${i(T)} lei. Depune diferența la bancă în cel mult două zile lucrătoare.`),s>=0&&l.push(`Soldul devine negativ după înregistrarea ${s+1}. Casa nu poate avea sold negativ; verifică sumele.`),{balances:c,total_receipts:o,total_payments:e,closing_balance:a,over_limit:m,negative_at:s,warnings:l}}function D(t,a,o={}){const e=C(t),s=t.entries.map((l,m)=>`<tr>
<td class="ctr">${m+1}</td>
<td>${n(l.doc)}</td>
<td class="ctr">${n(l.annexes??"")}</td>
<td>${n(l.description)}</td>
<td class="num">${l.receipt?n(i(l.receipt)):""}</td>
<td class="num">${l.payment?n(i(l.payment)):""}</td>
<td class="num">${n(i(e.balances[m]))}</td>
</tr>`).join(`
`),c=`<h1 class="doc-title">Registrul de casă</h1>
<div class="doc-meta">
<span><b>Unitatea:</b> ${n(t.company)}</span>
<span><b>Contul:</b> 5311 Casa în lei</span>
<span><b>Data:</b> ${n(b(t.date)??t.date)}</span>
<span><b>Valori în lei</b></span>
</div>
<table class="doc">
<thead><tr><th>Nr. crt.</th><th>Nr. act casă</th><th>Nr. anexe</th><th>Explicații</th><th>Încasări</th><th>Plăți</th><th>Sold</th></tr></thead>
<tbody>
<tr><td></td><td></td><td></td><td><b>Report/Sold ziua precedentă</b></td><td></td><td></td><td class="num"><b>${i(t.opening_balance)}</b></td></tr>
${s}
</tbody>
<tfoot>
<tr><td colspan="4">TOTAL</td><td class="num">${i(e.total_receipts)}</td><td class="num">${i(e.total_payments)}</td><td></td></tr>
<tr><td colspan="4">Sold final</td><td></td><td></td><td class="num">${i(e.closing_balance)}</td></tr>
</tfoot>
</table>
${e.warnings.map(l=>`<p class="warn">${n(l)}</p>`).join(`
`)}
<div class="signs">
<div>Casier<span>Nume, prenume, semnătura</span></div>
<div>Compartiment financiar-contabil<span>Nume, prenume, semnătura</span></div>
</div>`;return y({kind:"cashbook",title:`Registrul de casă ${b(t.date)??t.date}`,expiresAt:a.expires_at,body:c,local:o.local})}function S(t){return t.quantity_received??t.quantity}function R(t,a){const o=S(t),e=d(o*t.unit_cost),s=d(e*t.vat_rate/100),c=d(e+s);let l=null;if(t.sale_price!==void 0&&t.sale_price!==null?l=d(t.sale_price):a!=null&&(l=d(t.unit_cost*(1+a/100)*(1+t.vat_rate/100))),l===null)return{cost_value:e,cost_vat:s,cost_total:c,sale_price:l,sale_value:null,sale_vat:null,markup_value:null,markup_percent:null};const m=d(o*l),u=d(m/(1+t.vat_rate/100)),r=d(m-u),_=d(u-e),p=e>0?d(_/e*100):null;return{cost_value:e,cost_vat:s,cost_total:c,sale_price:l,sale_value:m,sale_vat:r,markup_value:_,markup_percent:p}}function O(t){const a={cost_value:0,cost_vat:0,cost_total:0,sale_value:0,sale_vat:0,markup_value:0,complete_sale:!0,vat_groups:[]},o=new Map;for(const e of t.lines){const s=R(e,t.markup_percent);a.cost_value+=s.cost_value,a.cost_vat+=s.cost_vat,a.cost_total+=s.cost_total,s.sale_value===null?a.complete_sale=!1:(a.sale_value+=s.sale_value,a.sale_vat+=s.sale_vat??0,a.markup_value+=s.markup_value??0);const c=o.get(e.vat_rate)??{rate:e.vat_rate,base:0,vat:0,total:0};c.base+=s.cost_value,c.vat+=s.cost_vat,c.total+=s.cost_total,o.set(e.vat_rate,c)}for(const e of["cost_value","cost_vat","cost_total","sale_value","sale_vat","markup_value"])a[e]=d(a[e]);return a.vat_groups=[...o.values()].sort((e,s)=>e.rate-s.rate).map(e=>({rate:e.rate,base:d(e.base),vat:d(e.vat),total:d(e.total)})),a}const $="—",x=t=>t===null?$:i(t),z=`
.parties{display:flex;gap:6mm;margin:0 0 4mm}
.party{flex:1;border:1px solid #94a3b8;padding:2mm 3mm;font-size:9pt}
.party .lbl{font-size:7.5pt;font-weight:700;color:#475569;letter-spacing:.05em}
.party .nm{font-size:10.5pt;font-weight:700}
.party .tax{font-size:8.5pt;color:#334155}
.vat-sum{width:60%;margin-top:4mm;margin-left:auto}
`,N="______________",I=t=>t?n(t):N;function P(t,a,o={}){const e=O(t),s=[],c=t.lines.map((r,_)=>{const p=R(r,t.markup_percent),f=S(r);if(f!==r.quantity){const k=Math.round((f-r.quantity)*1e3)/1e3;s.push(`linia ${_+1} (${n(r.name)}): ${n(h(r.quantity))} ${n(r.unit)} pe document, ${n(h(f))} ${n(r.unit)} recepționate (${k>0?"+":""}${n(h(k))})`)}return`<tr>
<td class="ctr">${_+1}</td>
<td>${n(r.name)}</td>
<td class="ctr">${n(r.unit)}</td>
<td class="num">${n(h(r.quantity))}</td>
<td class="num">${n(h(f))}</td>
<td class="num">${n(i(r.unit_cost))}</td>
<td class="num">${n(i(p.cost_value))}</td>
<td class="ctr">${n(String(r.vat_rate))}%</td>
<td class="num">${n(i(p.cost_vat))}</td>
<td class="num">${n(p.markup_percent===null?$:`${i(p.markup_percent)}%`)}</td>
<td class="num">${n(x(p.markup_value))}</td>
<td class="num">${n(x(p.sale_vat))}</td>
<td class="num">${n(x(p.sale_price))}</td>
<td class="num">${n(x(p.sale_value))}</td>
</tr>`}).join(`
`),l=e.vat_groups.map(r=>`<tr><td>TVA ${n(String(r.rate))}%</td><td class="num">${i(r.base)}</td><td class="num">${i(r.vat)}</td><td class="num">${i(r.total)}</td></tr>`).join(`
`),m=r=>r?`<div class="tax">CIF: ${n(r)}</div>`:"",u=`<h1 class="doc-title">Notă de recepție și constatare de diferențe (NIR)</h1>
<div class="parties">
<div class="party"><div class="lbl">UNITATEA (CUMPĂRĂTOR)</div><div class="nm">${n(t.company)}</div>${m(t.company_tax_id)}</div>
<div class="party"><div class="lbl">FURNIZOR</div><div class="nm">${n(t.supplier)}</div>${m(t.supplier_tax_id)}</div>
</div>
<div class="doc-meta">
<span><b>NIR nr.:</b> ${I(t.nir_number)}</span>
<span><b>Data NIR:</b> ${t.nir_date?n(b(t.nir_date)??t.nir_date):N}</span>
<span><b>Gestiunea:</b> ${I(t.management)}</span>
<span><b>Factura / avizul nr.:</b> ${n(t.invoice_number)}</span>
<span><b>Data facturii:</b> ${n(b(t.invoice_date)??t.invoice_date)}</span>
${t.markup_percent!==void 0?`<span><b>Adaos comercial:</b> ${n(i(t.markup_percent))}%</span>`:""}
<span><b>Valori în lei</b></span>
</div>
<table class="doc">
<thead>
<tr><th rowspan="2">Nr. crt.</th><th rowspan="2">Denumirea bunurilor</th><th rowspan="2">UM</th><th colspan="2">Cantitate</th>
<th colspan="4">Preț de achiziție</th><th colspan="2">Adaos comercial</th><th rowspan="2">TVA neexigibilă</th><th colspan="2">Preț de vânzare (cu TVA)</th></tr>
<tr><th>Conform documentelor</th><th>Recepționată</th><th>Preț unitar fără TVA</th><th>Valoare fără TVA</th><th>TVA %</th><th>Valoare TVA</th><th>%</th><th>Valoare</th><th>Preț unitar</th><th>Valoare</th></tr>
</thead>
<tbody>
${c}
</tbody>
<tfoot>
<tr><td colspan="6">TOTAL</td><td class="num">${i(e.cost_value)}</td><td></td><td class="num">${i(e.cost_vat)}</td><td></td>
<td class="num">${e.sale_value?i(e.markup_value):$}</td><td class="num">${e.sale_value?i(e.sale_vat):$}</td><td></td><td class="num">${e.sale_value?i(e.sale_value):$}</td></tr>
</tfoot>
</table>
<table class="doc vat-sum">
<thead><tr><th>Cota TVA</th><th>Baza (achiziție)</th><th>TVA</th><th>Total cu TVA</th></tr></thead>
<tbody>
${l}
</tbody>
<tfoot><tr><td>TOTAL</td><td class="num">${i(e.cost_value)}</td><td class="num">${i(e.cost_vat)}</td><td class="num">${i(e.cost_total)}</td></tr></tfoot>
</table>
${s.length?`<p class="warn">Diferențe la recepție: ${s.join("; ")}.</p>`:""}
${e.complete_sale?"":'<p class="note muted">Liniile fără preț de vânzare (nici preț dat, nici adaos) au valorile de vânzare goale.</p>'}
<div class="signs">
<div>Comisia de recepție<span>Nume, prenume, semnătura</span></div>
<div>Primit în gestiune (gestionar)<span>Nume, prenume, semnătura</span></div>
<div>Data primirii în gestiune<span>&nbsp;</span></div>
</div>`;return y({kind:"nir",title:`NIR ${t.nir_number??t.invoice_number}`,expiresAt:a.expires_at,body:u,css:z,landscape:!0,local:o.local})}function U(t){let a=d(t.opening_stock);return{rows:t.rows.map(e=>{const s=e.entries_in??0,c=e.entries_out??0;return a=d(a+s-c),{stock:a}}),closing_stock:a}}function V(t,a,o={}){const e=o.blank??!1,s=e?{rows:[],closing_stock:0}:U(t),c=e?Array.from({length:12},()=>"<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join(`
`):t.rows.map((u,r)=>{const _=s.rows[r]?.stock??0,p=u.entries_in,f=u.entries_out;return`<tr>
<td>${n(b(u.date)??u.date)}</td>
<td>${n(u.doc_number)}</td>
<td>${n(u.doc_type)}</td>
<td class="num">${p!==void 0&&p!==0?n(h(p)):""}</td>
<td class="num">${f!==void 0&&f!==0?n(h(f)):""}</td>
<td class="num">${n(h(_))}</td>
<td></td>
<td>${n(u.control_signature??"")}</td>
</tr>`}).join(`
`),l=t.unit_price!==void 0&&t.unit_price!==null&&!e?i(t.unit_price):"",m=`<h1 class="doc-title">Fișă de magazie</h1>
<p class="doc-code">Cod formular 14-3-8 (OMFP nr. 2.634/2015)</p>
<div class="doc-meta">
<span><b>Unitatea:</b> ${e?"":n(t.company)}</span>
<span><b>Magazia:</b> ${e?"":n(t.warehouse)}</span>
</div>
<div class="doc-meta">
<span><b>Materialul (produsul):</b> ${e?"":n(t.product)}</span>
${t.product_code||e?`<span><b>Cod:</b> ${e?"":n(t.product_code??"")}</span>`:""}
<span><b>U/M:</b> ${e?"":n(t.unit)}</span>
<span><b>Preț unitar:</b> ${l?`${n(l)} lei`:""}</span>
</div>
<table class="doc">
<thead>
<tr>
<th rowspan="2">Data</th>
<th colspan="2">Document</th>
<th rowspan="2">Intrări</th>
<th rowspan="2">Ieșiri</th>
<th rowspan="2">Stoc</th>
<th colspan="2">Data și semnătura de control</th>
</tr>
<tr>
<th>Număr</th>
<th>Fel</th>
<th colspan="2"></th>
</tr>
</thead>
<tbody>
${e?c:`<tr>
<td></td><td></td><td><b>Stoc inițial</b></td>
<td class="num"></td><td class="num"></td><td class="num"><b>${n(h(t.opening_stock))}</b></td><td colspan="2"></td>
</tr>
${c}`}
</tbody>
</table>
${e?"":`<p class="doc-foot"><b>Stoc final:</b> ${n(h(s.closing_stock))} ${n(t.unit)}</p>`}
<div class="signs">
<div>Gestionar<span>Nume, prenume, semnătura</span></div>
<div>Compartiment financiar-contabil<span>Nume, prenume, semnătura</span></div>
</div>`;return y({kind:"warehouse_card",title:`Fișă de magazie${e?" (model gol)":""}`,expiresAt:a.expires_at,body:m,local:o.local})}const L=1,M=2,E=3;function j(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"")}function B(t){return String.fromCharCode(65+t)}function X(t,a,o){if(t===null||t==="")return"";if(typeof t=="number")return`<c r="${a}" s="${o?E:M}"><v>${t}</v></c>`;const e=typeof t=="string"?t:t.text;return`<c r="${a}" t="inlineStr"${o||typeof t!="string"?` s="${L}"`:""}><is><t xml:space="preserve">${j(e)}</t></is></c>`}function W(t){const a=C(t),o=[[{text:"Registrul de casă",bold:!0}],["Unitatea:",t.company,null,"Data:",b(t.date)??t.date],["Contul:","5311 Casa în lei",null,"Valori în lei"],[],["Nr. crt.","Nr. act casă","Nr. anexe","Explicații","Încasări","Plăți","Sold"],[null,null,null,"Report/Sold ziua precedentă",null,null,t.opening_balance]],e=new Set([4]);if(t.entries.forEach((s,c)=>{o.push([c+1,s.doc,s.annexes??null,s.description,s.receipt??null,s.payment??null,a.balances[c]])}),e.add(o.length),o.push(["TOTAL",null,null,null,a.total_receipts,a.total_payments,null]),e.add(o.length),o.push(["Sold final",null,null,null,null,null,a.closing_balance]),a.warnings.length){o.push([]);for(const s of a.warnings)o.push([{text:`Atenție: ${s}`,bold:!0}])}return o.push([],["Casier (nume, prenume, semnătura)",null,null,"Compartiment financiar-contabil (nume, prenume, semnătura)"]),{rows:o,boldRows:e}}function q(t,a){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="3" width="13" customWidth="1"/><col min="4" max="4" width="42" customWidth="1"/><col min="5" max="7" width="14" customWidth="1"/></cols>
<sheetData>${t.map((e,s)=>`<row r="${s+1}">${e.map((c,l)=>X(c,`${B(l)}${s+1}`,a.has(s))).join("")}</row>`).join("")}</sheetData>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`}const H=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,K=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,G=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Registru" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,Q=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,Y=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
</styleSheet>`,Z="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";function J(t){const{rows:a,boldRows:o}=W(t);return F({"[Content_Types].xml":v(H),"_rels/.rels":v(K),"xl/workbook.xml":v(G),"xl/_rels/workbook.xml.rels":v(Q),"xl/styles.xml":v(Y),"xl/worksheets/sheet1.xml":v(q(a,o))})}function tt(t,a){const o=document.createElement("a");o.href=URL.createObjectURL(t),o.download=a,o.rel="noopener",document.body.appendChild(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(o.href),5e3)}const w={kind:"local",payload:null,expires_at:null};function et(t){return D(t,{...w},{local:!0})}function at(t){return P(t,{...w},{local:!0})}function g(t){const a=window.open("","_blank");return a?(a.opener=null,a.document.open(),a.document.write(t),a.document.close(),!0):!1}function lt(t,a){const o=new Blob([J(t)],{type:Z}),e=t.date.replace(/-/g,"");tt(o,`registru-de-casa-${e}.xlsx`)}function rt(t){return g(at(t))}function it(t){return g(et(t))}function A(t,a=!1){return V(t,{...w},{local:!0,blank:a})}function ct(t){return g(A(t))}function dt(t){return g(A(t,!0))}export{it as a,lt as b,C as c,rt as d,ct as e,dt as f,O as n,g as o,U as w};
