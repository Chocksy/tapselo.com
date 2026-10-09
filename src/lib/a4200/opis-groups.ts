import { runIdentifierChecks } from "./identifier-checks.ts";
import { runCrossChecks } from "./crosscheck.ts";
import { buildOpisCheckSummary } from "./check-summary.ts";
import { countBlockingIssues } from "./wizard.ts";
import type { CheckerIssue, ClassifiedFile, ParsedOpis } from "./types.ts";
import { isCrossMonthFallbackExport, type DayEntry } from "./day-groups.ts";
import { parseDayXml, parseOpisXml } from "./parse.ts";
import { explainParseError } from "./explain.ts";

export interface OpisExportGroup {
  key: string;
  opisFile: string;
  opis: ParsedOpis;
  days: DayEntry[];
}

export interface UploadPartitionResult {
  groups: OpisExportGroup[];
  unassignedDays: DayEntry[];
  overlappingDays: { day: DayEntry; opisFiles: string[] }[];
  foreign: string[];
  parseIssues: CheckerIssue[];
}

function issue(
  code: string,
  title: string,
  ceInseamna: string,
  ceFaci: string,
  file?: string,
): CheckerIssue {
  return { severity: "error", code, title, ceInseamna, ceFaci, file };
}

function dayInOpisRange(day: ParsedDay, opis: ParsedOpis): boolean {
  const z = day.zReport;
  return z >= opis.nrRapI && z <= opis.nrRapF && day.nui === opis.nui;
}

export function partitionUploadByOpis(files: ClassifiedFile[]): UploadPartitionResult {
  const parseIssues: CheckerIssue[] = [];
  const foreign: string[] = [];
  const opisEntries: { file: string; opis: ParsedOpis }[] = [];
  const dayEntries: DayEntry[] = [];

  for (const f of files) {
    if (f.kind === "foreign") {
      foreign.push(f.name);
      continue;
    }
    if (f.kind === "unreadable") {
      parseIssues.push(explainParseError(f.parseError ?? "Fișier necitit", f.name));
      continue;
    }
    if (f.parseError && f.xml) {
      parseIssues.push(explainParseError(f.parseError, f.name));
      continue;
    }
    if (!f.xml) continue;

    try {
      if (f.kind === "opis") {
        opisEntries.push({ file: f.name, opis: parseOpisXml(f.xml) });
      } else if (f.kind === "day") {
        dayEntries.push({ file: f.name, parsed: parseDayXml(f.xml, f.name) });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare XML";
      parseIssues.push(explainParseError(msg, f.name));
    }
  }

  const groups: OpisExportGroup[] = opisEntries.map((o, i) => ({
    key: `opis-${i}-${o.opis.nrRapI}-${o.opis.nrRapF}`,
    opisFile: o.file,
    opis: o.opis,
    days: [],
  }));

  const unassignedDays: DayEntry[] = [];
  const overlappingDays: { day: DayEntry; opisFiles: string[] }[] = [];

  for (const day of dayEntries) {
    const matches = groups.filter((g) => dayInOpisRange(day.parsed, g.opis));
    if (matches.length === 0) {
      unassignedDays.push(day);
    } else if (matches.length === 1) {
      matches[0].days.push(day);
    } else {
      overlappingDays.push({ day, opisFiles: matches.map((m) => m.opisFile) });
    }
  }

  return { groups, unassignedDays, overlappingDays, foreign, parseIssues };
}

export interface GroupCheckResult {
  group: OpisExportGroup;
  summary: ReturnType<typeof buildOpisCheckSummary>;
  issues: CheckerIssue[];
  readyForPdf: boolean;
  crossMonthFallback: boolean;
}

export function buildUploadLevelIssues(partition: UploadPartitionResult): CheckerIssue[] {
  const out: CheckerIssue[] = [...partition.parseIssues];

  if (partition.foreign.length > 0) {
    out.push(
      issue(
        "FOREIGN_FILES",
        "Fișiere străine în folder",
        `ANAF cere un folder cu doar opisul și zilele fiscale. Ai ${partition.foreign.length} fișier(e) nerecunoscut(e).`,
        "Mută în alt folder orice PDF, recipisă, export vechi sau alt tip de fișier. Păstrează doar opisul (.p7b / .xml) și zilele (.p7b / .xml).",
      ),
    );
  }

  for (const d of partition.unassignedDays) {
    out.push(
      issue(
        "Z_OUT_OF_RANGE",
        "Raport Z în afara opisului",
        `Ziua ${d.file} (raport ${d.parsed.zReport}) nu se potrivește cu niciun opis din încărcare.`,
        "Adaugă opisul care acoperă această zi sau scoate fișierul din selecție.",
        d.file,
      ),
    );
  }

  for (const o of partition.overlappingDays) {
    out.push(
      issue(
        "DAY_OVERLAPPING_OPIS",
        "Zi în mai multe exporturi",
        `Ziua ${o.day.file} se potrivește cu mai multe opisuri: ${o.opisFiles.join(", ")}.`,
        "Încarcă exporturile în arhive sau foldere separate, fără zile comune între opisuri.",
        o.day.file,
      ),
    );
  }

  if (partition.groups.length === 0) {
    out.push(
      issue(
        "NO_OPIS",
        "Lipsește opisul",
        "Nu am găsit fișierul opis (rădăcină mReg) în selecție.",
        "Adaugă Perioada_raportare.p7b sau echivalentul XML semnat de casă.",
      ),
    );
  }

  return out;
}

export function runGroupChecks(group: OpisExportGroup): GroupCheckResult {
  const input = {
    opis: group.opis,
    days: group.days,
    foreign: [],
    opisFiles: [group.opisFile],
  };
  const issues = [...runIdentifierChecks(input), ...runCrossChecks(input)];
  const summary = buildOpisCheckSummary(input);
  const blocking = countBlockingIssues(issues);
  const crossMonthFallback = isCrossMonthFallbackExport(
    group.days,
    group.opis.nrRapI,
    group.opis.nrRapF,
  );
  const readyForPdf =
    summary !== null &&
    summary.presentCount === summary.expectedCount &&
    blocking === 0 &&
    group.days.length > 0;

  return { group, summary, issues, readyForPdf, crossMonthFallback };
}

export function runFullUploadChecks(files: ClassifiedFile[]): {
  partition: UploadPartitionResult;
  uploadIssues: CheckerIssue[];
  groups: GroupCheckResult[];
} {
  const partition = partitionUploadByOpis(files);
  const uploadIssues = buildUploadLevelIssues(partition);
  const groups = partition.groups.map((g) => runGroupChecks(g));
  return { partition, uploadIssues, groups };
}
