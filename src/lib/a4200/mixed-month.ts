import { formatZ } from "./check-summary.ts";
import {
  countDaysWithCloseInOtherMonth,
  formatReportingDeadlineRo,
  formatSegmentZRange,
  isReportingDeadlinePassed,
  splitDaysByMonth,
  type DayEntry,
  type MonthDaySegment,
} from "./day-groups.ts";
import { RO_MONTHS } from "./constants.ts";
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

export function groupCardLabel(days: DayEntry[], fallbackZFrom: number, fallbackZTo: number): string {
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

export function formatMixedMonthSegmentLine(seg: MonthDaySegment): string {
  const month = RO_MONTHS[seg.luna - 1];
  const zRange = formatSegmentZRange(seg);
  const zile = seg.count === 1 ? "1 zi" : `${seg.count} zile`;
  return `**${month} ${seg.an} – ${zRange} (${zile})**`;
}

export function buildMixedMonthExplanation(days: DayEntry[], _opis?: ParsedOpis | null): string {
  const segments = splitDaysByMonth(days);
  const n = segments.length;
  const parts = segments.map((s) => {
    const month = RO_MONTHS[s.luna - 1];
    const zRange = formatSegmentZRange(s);
    const zile = s.count === 1 ? "1 zi" : `${s.count} zile`;
    return `<strong>${month} ${s.an} – ${zRange} (${zile})</strong>`;
  });
  const list =
    n <= 1
      ? parts[0] ?? ""
      : parts.slice(0, -1).join(", ") + " și " + parts[parts.length - 1];
  return `Exportul acoperă ${n} ${n === 1 ? "lună" : "luni"}: ${list}. ANAF cere câte un A4200 pe lună, fiecare cu fișierul de perioadă semnat de casă, așa că nu putem împărți noi acest export.`;
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
