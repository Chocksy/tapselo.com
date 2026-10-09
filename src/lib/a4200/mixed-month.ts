import { formatZ, formatZRange } from "./check-summary.ts";
import {
  countDaysWithCloseInOtherMonth,
  dateRangeFromDays,
  formatReportingDeadlineRo,
  formatSegmentZRange,
  isReportingDeadlinePassed,
  splitDaysByMonth,
  type DayEntry,
  type MonthDaySegment,
} from "./day-groups.ts";
import { RO_MONTHS } from "./constants.ts";
import { periodFromIdM } from "./parse.ts";
import type { ParsedOpis } from "./types.ts";

export function formatSpanPeriodLabel(segments: MonthDaySegment[]): string | null {
  if (segments.length === 0) return null;
  if (segments.length === 1) {
    const s = segments[0];
    return `${RO_MONTHS[s.luna - 1]} ${s.an}`;
  }
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first.an === last.an) {
    return `${RO_MONTHS[first.luna - 1]}–${RO_MONTHS[last.luna - 1]} ${first.an}`;
  }
  return `${RO_MONTHS[first.luna - 1]} ${first.an}–${RO_MONTHS[last.luna - 1]} ${last.an}`;
}

export function formatMonthRangeKey(segments: MonthDaySegment[]): string | null {
  if (segments.length === 0) return null;
  const keys = segments.map((s) => `${s.an}-${String(s.luna).padStart(2, "0")}`);
  if (keys.length === 1) return keys[0];
  return `${keys[0]}_${keys[keys.length - 1]}`;
}

export function crossMonthPdfCardLabel(days: DayEntry[], opis: ParsedOpis): string {
  const segments = splitDaysByMonth(days);
  const span = formatSpanPeriodLabel(segments) ?? "mai multe luni";
  const zRange = formatZRange(opis);
  const n = days.length;
  const zile = n === 1 ? "1 zi" : `${n} zile`;
  return `${span} · ${zRange} · ${zile} (export pe mai multe luni)`;
}

export function groupCardLabel(
  days: DayEntry[],
  fallbackZFrom: number,
  fallbackZTo: number,
  crossMonthFallback = false,
  opis?: ParsedOpis | null,
): string {
  if (crossMonthFallback && opis) return crossMonthPdfCardLabel(days, opis);
  const segments = splitDaysByMonth(days);
  if (segments.length === 1) return formatSegmentCardLabel(segments[0]);
  if (segments.length > 1) {
    return segments.map((s) => formatSegmentCardLabel(s)).join(" · ");
  }
  const count = days.length;
  const zile = count === 1 ? "1 zi" : `${count} zile`;
  const zRange =
    fallbackZFrom === fallbackZTo
      ? formatZ(fallbackZFrom)
      : `${formatZ(fallbackZFrom)}–${formatZ(fallbackZTo)}`;
  return `${zRange} · ${zile}`;
}

export function formatSegmentCardLabel(seg: MonthDaySegment): string {
  const month = RO_MONTHS[seg.luna - 1];
  const zRange = formatSegmentZRange(seg);
  const zile = seg.count === 1 ? "1 zi" : `${seg.count} zile`;
  return `${month} ${seg.an} · ${zRange} · ${zile}`;
}

export function formatMixedMonthSegmentListHtml(segments: MonthDaySegment[]): string {
  return segments
    .map((s) => {
      const month = RO_MONTHS[s.luna - 1];
      const zRange = formatSegmentZRange(s);
      const zile = s.count === 1 ? "1 zi" : `${s.count} zile`;
      return `<strong>${month} ${s.an}</strong> – ${zRange} (${zile})`;
    })
    .join(", ");
}

export function buildCrossMonthWarningHtml(days: DayEntry[]): string {
  const segments = splitDaysByMonth(days);
  const n = segments.length;
  const list = formatMixedMonthSegmentListHtml(segments);
  return `<p>Exportul acoperă <strong>${n} luni calendaristice</strong>: ${list}.</p>
<p>Conform OPANAF nr. 627/2018, art. 2 alin. (4), perioada de raportare este luna calendaristică (de regulă, câte o declarație A4200 pe lună). Dacă termenele au trecut, depunerea acum poate fi mai utilă decât amânarea.</p>
<p>Recomandăm, pe cât posibil, exporturi lunare separate de la service — butonul de mai jos generează un mesaj pentru tehnician.</p>`;
}

export function buildServiceTechnicianMessage(segments: MonthDaySegment[]): string {
  const ranges = segments.map((s) => {
    const zFrom = formatZ(s.zFrom);
    const zTo = formatZ(s.zTo);
    return s.zFrom === s.zTo ? zFrom : `${zFrom}–${zTo}`;
  });
  const list = ranges.join(" și ");
  return `Te rog fă exporturi separate din casă (La cerere ANAF → după număr Z): ${list}, fiecare pe stick gol / în arhivă separată.`;
}

export function buildSpvAnafMessage(days: DayEntry[], opis: ParsedOpis): string {
  const segments = splitDaysByMonth(days);
  const zFrom = formatZ(opis.nrRapI);
  const zTo = formatZ(opis.nrRapF);
  const zRange = opis.nrRapI === opis.nrRapF ? zFrom : `${zFrom}–${zTo}`;
  const range = dateRangeFromDays(days);
  const periodText = range ? `${range.from} – ${range.to}` : "perioada din borderou";
  const exportPeriod = periodFromIdM(opis.idM);
  const exportMonth =
    exportPeriod != null
      ? `${RO_MONTHS[exportPeriod.luna - 1]} ${exportPeriod.an}`
      : "luna înregistrării exportului";

  return `Bună ziua,

Vă informez că declarația A4200 înregistrată la ${exportMonth} acoperă rapoartele ${zRange}, pentru intervalul ${periodText}, așa cum au fost exportate din casa de marcat.

nr. recipisă: ________

Vă mulțumesc.`;
}

export function buildLateDeadlineLines(segments: MonthDaySegment[], now = new Date()): string[] {
  const lines: string[] = [];
  for (const s of segments) {
    if (isReportingDeadlinePassed(s.an, s.luna, now)) {
      const month = RO_MONTHS[s.luna - 1];
      lines.push(`Termenul pentru ${month} ${s.an} a fost ${formatReportingDeadlineRo(s.an, s.luna)}.`);
    }
  }
  return lines;
}

export function buildCrossMonthCloseNote(days: DayEntry[]): string | null {
  const n = countDaysWithCloseInOtherMonth(days);
  if (n === 0) return null;
  return `${n} ${n === 1 ? "zi are" : "zile au"} închiderea fiscală (raport Z) în altă lună decât deschiderea — verifică că restul lunii e declarat separat / AMEF conectat.`;
}

export const ANAF_PDF_EXPORT_MONTH_NOTE =
  "În PDF, ANAF trece la «luna declarării» luna exportului (ex. 10). E normal; contează zilele și Z-urile din borderou.";
