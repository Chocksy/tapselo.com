import { periodFromIdM, zFromFileName } from "./parse.ts";
import type { ParsedDay } from "./types.ts";

export interface DayEntry {
  file: string;
  parsed: ParsedDay;
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
