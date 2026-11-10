import type { DraftRecord } from "./types.ts";
import type {
  FridgeCleaningLogPayload,
  FridgeTempLogPayload,
} from "../unelte/fridge-temp-types.ts";
import { escapeHtml, renderShell } from "./page.ts";

const MONTH_NAMES = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
];

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

const KIND_LABEL: Record<string, string> = {
  frigider: "Frigider",
  congelator: "Congelator",
  vitrina: "Vitrină",
  altul: "Altul",
};

export interface RenderOptions {
  local?: boolean;
  blank?: boolean;
  landscape?: boolean;
}

function monthLabel(month: number, year: number): string {
  const m = MONTH_NAMES[month - 1] ?? String(month);
  return `${m} ${year}`;
}

function limitCell(min?: number, max?: number, blank?: boolean): string {
  if (blank) return "";
  const parts: string[] = [];
  if (min !== undefined && Number.isFinite(min)) parts.push(`min ${min} °C`);
  if (max !== undefined && Number.isFinite(max)) parts.push(`max ${max} °C`);
  return escapeHtml(parts.join(" / ") || "—");
}

export function renderFridgeTempLog(
  p: FridgeTempLogPayload,
  draft: DraftRecord,
  opts: RenderOptions = {},
): string {
  const blank = opts.blank ?? false;
  const landscape = opts.landscape ?? false;
  const dim = daysInMonth(p.month, p.year);

  const applianceBlocks = (p.appliances.length ? p.appliances : [{ name: "", kind: "frigider" as const, days: [] }])
    .map((a) => {
      const title = blank ? "" : escapeHtml(a.name || KIND_LABEL[a.kind] || "Aparat");
      const kind = blank ? "" : escapeHtml(KIND_LABEL[a.kind] ?? a.kind);
      const limits = limitCell(a.temp_min, a.temp_max, blank);
      return `<div class="appliance-block">
<p class="appliance-title"><b>${title}</b> ${kind ? `<span class="muted">(${kind})</span>` : ""} — ${limits}</p>
<table class="doc">
<thead>
<tr>
<th rowspan="2">Ziua</th>
<th colspan="2">Dimineața</th>
<th colspan="2">Seara</th>
<th rowspan="2">Observații / acțiuni</th>
</tr>
<tr>
<th>Temp. °C</th>
<th>Parafă</th>
<th>Temp. °C</th>
<th>Parafă</th>
</tr>
</thead>
<tbody>
${Array.from({ length: dim }, (_, i) => {
  const day = i + 1;
      const dayRows = blank ? [] : (a.days?.length ? a.days : p.days);
      const row = blank ? null : dayRows[i];
  const mTemp = blank ? "" : escapeHtml(row?.morning_temp ?? "");
  const mIni = blank ? "" : escapeHtml(row?.morning_initials ?? "");
  const eTemp = blank ? "" : escapeHtml(row?.evening_temp ?? "");
  const eIni = blank ? "" : escapeHtml(row?.evening_initials ?? "");
  const notes = blank ? "" : escapeHtml(row?.notes ?? "");
  return `<tr>
<td class="ctr">${day}</td>
<td class="ctr">${mTemp}</td>
<td class="ctr">${mIni}</td>
<td class="ctr">${eTemp}</td>
<td class="ctr">${eIni}</td>
<td>${notes}</td>
</tr>`;
}).join("\n")}
</tbody>
</table>
</div>`;
    })
    .join("\n");

  const body = `<h1 class="doc-title">Grafic de temperatură frigider și congelator</h1>
<p class="muted ctr">Model lunar de lucru — nu este un formular numit în lege</p>
<div class="doc-meta">
<span><b>Firmă:</b> ${blank ? "" : escapeHtml(p.company)}</span>
<span><b>CUI:</b> ${blank ? "" : escapeHtml(p.company_tax_id ?? "")}</span>
</div>
<div class="doc-meta">
<span><b>Punct de lucru:</b> ${blank ? "" : escapeHtml(p.location ?? "")}</span>
<span><b>Luna:</b> ${blank ? "" : escapeHtml(monthLabel(p.month, p.year))}</span>
</div>
${applianceBlocks}
<div class="signs">
<div><b>Responsabil:</b> ${blank ? "" : escapeHtml(p.responsible_name ?? "")}<br/><b>Funcție:</b> ${blank ? "" : escapeHtml(p.responsible_role ?? "")}<span>Semnătură</span></div>
</div>`;

  return renderShell({
    kind: "fridge_temp_log",
    title: `Grafic temperatură${blank ? " (model gol)" : ""}`,
    expiresAt: draft.expires_at,
    body,
    local: opts.local,
    landscape,
    css: `.appliance-block{margin-top:5mm;break-inside:avoid}.appliance-title{margin:0 0 2mm;font-size:9.5pt}`,
  });
}

export function renderFridgeCleaningLog(
  p: FridgeCleaningLogPayload,
  draft: DraftRecord,
  opts: RenderOptions = {},
): string {
  const blank = opts.blank ?? false;
  const zoneNames = p.zones.map((z) => z.name).filter(Boolean);

  const rows = blank
    ? Array.from({ length: 20 }, () => "<tr><td></td><td></td><td></td><td></td><td></td></tr>").join("\n")
    : p.rows
        .map((r) => {
          const mark = r.done ? "✓" : "";
          return `<tr>
<td>${escapeHtml(r.date ?? "")}</td>
<td>${escapeHtml(r.zone ?? "")}</td>
<td class="ctr">${mark}</td>
<td class="ctr">${escapeHtml(r.initials ?? "")}</td>
<td>${escapeHtml(r.notes ?? "")}</td>
</tr>`;
        })
        .join("\n");

  const zoneList = blank ? "" : escapeHtml(zoneNames.join("; "));

  const body = `<h1 class="doc-title">Grafic de curățenie și dezinfecție</h1>
<p class="muted ctr">Model lunar opțional — nu este un formular numit în lege</p>
<div class="doc-meta">
<span><b>Firmă:</b> ${blank ? "" : escapeHtml(p.company)}</span>
<span><b>Punct de lucru:</b> ${blank ? "" : escapeHtml(p.location ?? "")}</span>
<span><b>Luna:</b> ${blank ? "" : escapeHtml(monthLabel(p.month, p.year))}</span>
</div>
<p class="note"><b>Zone / echipamente:</b> ${zoneList}</p>
<table class="doc">
<thead>
<tr>
<th>Data</th>
<th>Zonă / echipament</th>
<th>Bifat</th>
<th>Parafă</th>
<th>Observații</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
<div class="signs">
<div><b>Responsabil:</b> ${blank ? "" : escapeHtml(p.responsible_name ?? "")}<br/><b>Funcție:</b> ${blank ? "" : escapeHtml(p.responsible_role ?? "")}<span>Semnătură</span></div>
</div>`;

  return renderShell({
    kind: "fridge_cleaning_log",
    title: `Grafic curățenie${blank ? " (model gol)" : ""}`,
    expiresAt: draft.expires_at,
    body,
    local: opts.local,
  });
}
