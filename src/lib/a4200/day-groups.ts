import { formatZ } from "./check-summary.ts";
import { periodFromIdM, zFromFileName } from "./parse.ts";
import type { ParsedDay } from "./types.ts";

export interface DayEntry {
  file: string;
  parsed: ParsedDay;
}

export interface MonthDaySegment {
  an: number;
  luna: number;
  zFrom: number;
  zTo: number;
  count: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function dayCalendarPeriod(day: ParsedDay): { an: number; luna: number } | null {
  if (day.an !== undefined && day.luna !== undefined) return { an: day.an, luna: day.luna };
  return periodFromIdM(day.idM);
}

function baseName(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf(":"));
  return idx === -1 ? path : path.slice(idx + 1);
}

function isP7b(name: string): boolean {
  const l = baseName(name).toLowerCase();
  return l.endsWith(".p7b") || l.endsWith(".p7s");
}

function isXml(name: string): boolean {
  return baseName(name).toLowerCase().endsWith(".xml");
}

/** Same Z as both PKCS#7 and plain XML (common when exporting twice). */
export function isP7bXmlPairForZ(files: string[], z: number): boolean {
  if (files.length !== 2) return false;
  const names = files.map(baseName);
  const oneP7bOneXml = (isP7b(names[0]) && isXml(names[1])) || (isXml(names[0]) && isP7b(names[1]));
  if (!oneP7bOneXml) return false;
  const zA = zFromFileName(names[0]);
  const zB = zFromFileName(names[1]);
  return (zA === null || zA === z) && (zB === null || zB === z);
}

export function labelDayFiles(files: string[]): string {
  if (files.length === 1) return files[0];
  return files.join(" + ");
}

export interface GroupedDays {
  uniqueZ: Set<number>;
  labelByZ: Map<number, string>;
  duplicateZ: { z: number; files: string }[];
}

export function groupDaysByZ(days: DayEntry[]): GroupedDays {
  const byZ = new Map<number, DayEntry[]>();
  for (const d of days) {
    const list = byZ.get(d.parsed.zReport) ?? [];
    list.push(d);
    byZ.set(d.parsed.zReport, list);
  }

  const uniqueZ = new Set<number>();
  const labelByZ = new Map<number, string>();
  const duplicateZ: { z: number; files: string }[] = [];

  for (const [z, entries] of byZ) {
    const names = entries.map((e) => e.file);
    uniqueZ.add(z);
    labelByZ.set(z, labelDayFiles(names));
    if (entries.length > 1 && !isP7bXmlPairForZ(names, z)) {
      duplicateZ.push({ z, files: labelDayFiles(names) });
    }
  }

  return { uniqueZ, labelByZ, duplicateZ };
}

export function checkSingleCalendarMonthAmongDays(days: DayEntry[]): { an: number; luna: number } | null {
  if (days.length === 0) return null;
  let ref: { an: number; luna: number } | null = null;
  for (const d of days) {
    const p = dayCalendarPeriod(d.parsed);
    if (!p) continue;
    if (!ref) ref = p;
    else if (p.an !== ref.an || p.luna !== ref.luna) return null;
  }
  return ref;
}

function idMDateLabel(idM: string): string | null {
  const p = periodFromIdM(idM);
  if (!p) return null;
  const day = idM.length >= 18 ? idM.slice(16, 18) : "??";
  return `${day}.${String(p.luna).padStart(2, "0")}.${p.an}`;
}

/** Sort by Z, then group consecutive days that share the same calendar month (from msj idM / an+luna). */
export function splitDaysByMonth(days: DayEntry[]): MonthDaySegment[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort((a, b) => a.parsed.zReport - b.parsed.zReport);
  const segments: MonthDaySegment[] = [];

  let current: MonthDaySegment | null = null;
  for (const d of sorted) {
    const p = dayCalendarPeriod(d.parsed);
    if (!p) continue;
    const z = d.parsed.zReport;
    if (
      !current ||
      current.an !== p.an ||
      current.luna !== p.luna ||
      z !== current.zTo + 1
    ) {
      if (current) segments.push(current);
      current = {
        an: p.an,
        luna: p.luna,
        zFrom: z,
        zTo: z,
        count: 1,
        firstDate: idMDateLabel(d.parsed.idM),
        lastDate: idMDateLabel(d.parsed.idM),
      };
    } else {
      current.zTo = z;
      current.count += 1;
      current.lastDate = idMDateLabel(d.parsed.idM);
    }
  }
  if (current) segments.push(current);
  return segments;
}

/** Days where fiscal close (rB idR) falls in a different calendar month than day start (idM). */
export function countDaysWithCloseInOtherMonth(days: DayEntry[]): number {
  let n = 0;
  for (const d of days) {
    const start = dayCalendarPeriod(d.parsed);
    const close = periodFromIdM(d.parsed.idR);
    if (!start || !close) continue;
    if (start.an !== close.an || start.luna !== close.luna) n += 1;
  }
  return n;
}

export function formatSegmentZRange(seg: MonthDaySegment): string {
  return seg.zFrom === seg.zTo ? formatZ(seg.zFrom) : `${formatZ(seg.zFrom)}–${formatZ(seg.zTo)}`;
}

export function reportingDeadlineDate(an: number, luna: number): Date {
  let year = an;
  let month = luna + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return new Date(year, month - 1, 20);
}

export function formatReportingDeadlineRo(an: number, luna: number): string {
  const d = reportingDeadlineDate(an, luna);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** dd.mm.yyyy from AMEF idM (positions 10–17 = YYYYMMDD). */
export function formatIdMDateRo(idM: string): string | null {
  if (idM.length < 16) return null;
  const y = idM.slice(10, 14);
  const m = idM.slice(14, 16);
  const d = idM.slice(16, 18);
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return null;
  return `${d}.${m}.${y}`;
}

export function dateRangeFromDays(days: DayEntry[]): { from: string; to: string } | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.parsed.zReport - b.parsed.zReport);
  const from = formatIdMDateRo(sorted[0].parsed.idM);
  const to = formatIdMDateRo(sorted[sorted.length - 1].parsed.idM);
  if (!from || !to) return null;
  return { from, to };
}

export function isCrossMonthFallbackExport(days: DayEntry[], nrRapI: number, nrRapF: number): boolean {
  if (days.length === 0) return false;
  if (checkSingleCalendarMonthAmongDays(days)) return false;
  const segments = splitDaysByMonth(days);
  if (segments.length < 2) return false;
  const expected = nrRapF - nrRapI + 1;
  if (days.length !== expected) return false;
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total !== expected) return false;
  if (segments[0].zFrom !== nrRapI || segments[segments.length - 1].zTo !== nrRapF) return false;
  return true;
}

export function isReportingDeadlinePassed(an: number, luna: number, now = new Date()): boolean {
  const deadline = reportingDeadlineDate(an, luna);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today > deadline;
}
