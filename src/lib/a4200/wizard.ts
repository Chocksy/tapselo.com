import { formatZ, formatZRange, type OpisCheckSummary } from "./check-summary.ts";
import { RO_MONTHS } from "./constants.ts";
import {
  checkSingleCalendarMonthAmongDays,
  isCrossMonthFallbackExport,
  splitDaysByMonth,
  type DayEntry,
} from "./day-groups.ts";
import {
  ANAF_PDF_EXPORT_MONTH_NOTE,
  buildCrossMonthCloseNote,
  buildCrossMonthWarningHtml,
  buildLateDeadlineLines,
  buildServiceTechnicianMessage,
  buildSpvAnafMessage,
  formatSpanPeriodLabel,
} from "./mixed-month.ts";
import { periodFromIdM } from "./parse.ts";
import type { CheckerIssue, ParsedOpis } from "./types.ts";
import type { GroupCheckResult } from "./opis-groups.ts";

export const WIZARD_STEP_COUNT = 4;

/** XSD codes allowed on real Datecs day exports without blocking the wizard (see tests/a4200-datecs-fixtures.test.ts). */
export const WIZARD_NON_BLOCKING_ERROR_CODES = new Set([
  "XSD_COTA_NEW_VAT",
  "XSD_COTA_ENUM",
  "XSD_OTHER",
  "XSD_MISSING_ATTR",
]);

export function countBlockingIssues(issues: CheckerIssue[]): number {
  return issues.filter((i) => i.severity === "error" && !WIZARD_NON_BLOCKING_ERROR_CODES.has(i.code)).length;
}

export { RO_MONTHS } from "./constants.ts";

export function resolveOpisPeriod(opis: ParsedOpis): { an: number; luna: number } | null {
  if (opis.an != null && opis.luna != null) return { an: opis.an, luna: opis.luna };
  return periodFromIdM(opis.idM);
}

/** Calendar month from opis attributes or idM (export timestamp) — not used for wizard copy when day files exist. */
export function formatPeriodLabelFromOpis(opis: ParsedOpis): string | null {
  const p = resolveOpisPeriod(opis);
  if (!p) return null;
  return `${RO_MONTHS[p.luna - 1]} ${p.an}`;
}

/** Fiscal month from day files (an/luna or idM), aligned with PERIOD_MISMATCH logic in crosscheck. */
export function formatPeriodLabelFromDays(days: DayEntry[]): string | null {
  const p = checkSingleCalendarMonthAmongDays(days);
  if (!p) return null;
  return `${RO_MONTHS[p.luna - 1]} ${p.an}`;
}

/** @deprecated Use formatPeriodLabelFromOpis or formatPeriodLabelFromDays */
export function formatPeriodLabel(opis: ParsedOpis): string | null {
  return formatPeriodLabelFromOpis(opis);
}

export function formatZRangePlain(opis: ParsedOpis): string {
  return formatZRange(opis);
}

/** Romanian count phrase: „30 din 31 de rapoarte” (≥20 takes „de”). */
export function formatReportCountPhrase(present: number, expected: number): string {
  const de = expected >= 20 ? " de" : "";
  return `${present} din ${expected}${de} rapoarte`;
}

export interface VerificationPlainSummary {
  ok: boolean;
  errorCount: number;
  headline: string;
  foundLine: string | null;
  missingLines: string[];
  periodLabel: string | null;
  mixedMonthHtml: string | null;
  serviceTechnicianMessage: string | null;
  spvAnafMessage: string | null;
  crossMonthFallback: boolean;
  infoLines: string[];
  pdfMonthNote: string | null;
}

export function buildVerificationPlainSummary(
  summary: OpisCheckSummary | null,
  issues: CheckerIssue[],
  days: DayEntry[] = [],
): VerificationPlainSummary {
  const errorCount = countBlockingIssues(issues);

  if (!summary) {
    return {
      ok: false,
      errorCount,
      headline:
        errorCount > 0
          ? "Trebuie rezolvate câteva probleme înainte de depunere."
          : "Adaugă fișierul de perioadă primit de la service (de obicei Perioada_raportare).",
      foundLine: null,
      missingLines: [],
      periodLabel: null,
      mixedMonthHtml: null,
      serviceTechnicianMessage: null,
      spvAnafMessage: null,
      crossMonthFallback: false,
      infoLines: [],
      pdfMonthNote: null,
    };
  }

  const segments = days.length > 0 ? splitDaysByMonth(days) : [];
  const singleMonth = days.length > 0 ? formatPeriodLabelFromDays(days) : null;
  const spanLabel = segments.length > 1 ? formatSpanPeriodLabel(segments) : null;
  const periodLabel = singleMonth ?? (days.length === 0 ? formatPeriodLabelFromOpis(summary.opis) : spanLabel);
  const mixedMonths = days.length > 0 && singleMonth === null && segments.length > 1;
  const crossMonthFallback =
    mixedMonths && isCrossMonthFallbackExport(days, summary.opis.nrRapI, summary.opis.nrRapF);
  const zPlain = formatZRangePlain(summary.opis);
  const complete = summary.presentCount === summary.expectedCount && errorCount === 0;
  const ok = complete && (!mixedMonths || crossMonthFallback);

  let foundLine: string;
  if (mixedMonths) {
    foundLine = `Am găsit rapoartele ${zPlain} pe ${segments.length} luni calendaristice (${spanLabel ?? "luni diferite"}).`;
  } else if (summary.presentCount === summary.expectedCount) {
    foundLine = periodLabel
      ? `Am găsit rapoartele ${zPlain} pentru ${periodLabel}.`
      : `Am găsit toate rapoartele ${zPlain} (${summary.expectedCount} zile).`;
  } else {
    const countPhrase = formatReportCountPhrase(summary.presentCount, summary.expectedCount);
    foundLine = periodLabel
      ? `Am găsit ${countPhrase} pentru ${periodLabel} (interval ${zPlain}).`
      : `Am găsit ${countPhrase} (interval ${zPlain}).`;
  }

  const missing = summary.rows.filter((r) => r.status === "missing");
  const missingLines = missing.map(
    (r) =>
      `Lipsește raportul ${formatZ(r.z)} — cere service-ului reexportul zilei sau verifică stick-ul de la casă.`,
  );

  let headline: string;
  const badCui = issues.some((i) => i.code === "CUI_CHECK_DIGIT");
  const badNui = issues.some((i) => i.code === "NUI_CHECK_DIGIT");
  if (ok && crossMonthFallback) {
    headline = "Exportul acoperă mai multe luni — poți genera un singur PDF, cu atenție.";
  } else if (ok) {
    headline = "Totul arată în regulă pentru depunere.";
  } else if (badCui && badNui) {
    headline = "Codul fiscal și numărul casei (NUI) din export par greșite.";
  } else if (badCui) {
    headline = "Codul fiscal (CUI) din export nu pare corect.";
  } else if (badNui) {
    headline = "Numărul casei de marcat (NUI) din export nu pare corect.";
  } else if (missing.length > 0) {
    headline = "Lipsesc zile din exportul de la casă.";
  } else if (mixedMonths) {
    headline = "Exportul acoperă mai multe luni calendaristice.";
  } else if (errorCount > 0) {
    headline = "Trebuie corectate unele probleme înainte de PDF.";
  } else {
    headline = "Verifică lista de mai jos.";
  }

  const mixedMonthHtml = crossMonthFallback ? buildCrossMonthWarningHtml(days) : null;
  const serviceTechnicianMessage = crossMonthFallback ? buildServiceTechnicianMessage(segments) : null;
  const spvAnafMessage = crossMonthFallback ? buildSpvAnafMessage(days, summary.opis) : null;
  const infoLines: string[] = [];
  if (crossMonthFallback) {
    infoLines.push(...buildLateDeadlineLines(segments));
    const closeNote = buildCrossMonthCloseNote(days);
    if (closeNote) infoLines.push(closeNote);
  }

  return {
    ok,
    errorCount,
    headline,
    foundLine,
    missingLines,
    periodLabel,
    mixedMonthHtml,
    serviceTechnicianMessage,
    spvAnafMessage,
    crossMonthFallback,
    infoLines,
    pdfMonthNote: crossMonthFallback || ok ? ANAF_PDF_EXPORT_MONTH_NOTE : null,
  };
}

export function buildUploadPlainSummary(
  uploadIssues: CheckerIssue[],
  groups: GroupCheckResult[],
): VerificationPlainSummary {
  const allIssues = [...uploadIssues, ...groups.flatMap((g) => g.issues)];
  const errorCount = countBlockingIssues(allIssues);
  const readyGroups = groups.filter((g) => g.readyForPdf);

  if (groups.length === 0) {
    return buildVerificationPlainSummary(null, uploadIssues, []);
  }

  if (groups.length === 1) {
    const g = groups[0];
    const plain = buildVerificationPlainSummary(g.summary, [...uploadIssues, ...g.issues], g.group.days);
    if (g.readyForPdf) {
      return {
        ...plain,
        ok: true,
        crossMonthFallback: g.crossMonthFallback,
        spvAnafMessage: g.crossMonthFallback ? buildSpvAnafMessage(g.group.days, g.group.opis) : plain.spvAnafMessage,
        mixedMonthHtml:
          g.crossMonthFallback ? buildCrossMonthWarningHtml(g.group.days) : plain.mixedMonthHtml,
        pdfMonthNote: ANAF_PDF_EXPORT_MONTH_NOTE,
      };
    }
    return plain;
  }

  const headline =
    readyGroups.length > 0
      ? `Am găsit ${groups.length} exporturi — ${readyGroups.length} ${readyGroups.length === 1 ? "este gata" : "sunt gata"} pentru PDF.`
      : "Trebuie rezolvate problemele din exporturile încărcate.";

  const foundLine = groups
    .map((g) => {
      const seg = splitDaysByMonth(g.group.days);
      const label = seg.length === 1 ? formatSpanPeriodLabel(seg) : formatZRangePlain(g.group.opis);
      return `${label ?? "Export"} (${formatZRangePlain(g.group.opis)})`;
    })
    .join("; ");

  return {
    ok: readyGroups.length > 0 && errorCount === countBlockingIssues(uploadIssues),
    errorCount,
    headline,
    foundLine,
    missingLines: [],
    periodLabel: null,
    mixedMonthHtml: null,
    serviceTechnicianMessage: null,
    spvAnafMessage: null,
    crossMonthFallback: false,
    infoLines: [],
    pdfMonthNote: ANAF_PDF_EXPORT_MONTH_NOTE,
  };
}

export function canProceedToPdfStep(plain: VerificationPlainSummary): boolean {
  return plain.ok;
}

export interface WizardButtonContext {
  hasFiles?: boolean;
  checksOk?: boolean;
  onStep3ReadyForAnaf?: boolean;
  pdfGenerated?: boolean;
}

export function primaryButtonLabel(step: number, ctx: WizardButtonContext = {}): string {
  switch (step) {
    case 1:
      return ctx.hasFiles ? "Verifică arhiva" : "Alege fișierele";
    case 2:
      return ctx.checksOk ? "Continuă: PDF și semnare" : "Încarcă din nou arhiva";
    case 3:
      return ctx.onStep3ReadyForAnaf ? "Continuă: încărcare ANAF" : "Descarcă PDF pentru semnare";
    case 4:
      return "Deschide portalul ANAF";
    default: {
      const never: never = step;
      return never;
    }
  }
}

export function stepHeading(step: number): string {
  switch (step) {
    case 1:
      return "Încarcă arhiva de la service";
    case 2:
      return "Verificăm fișierele";
    case 3:
      return "Descarcă PDF-ul și semnează-l";
    case 4:
      return "Încarcă la ANAF și verifică recipisa";
    default: {
      const never: never = step;
      return never;
    }
  }
}

/** Focus target id for accessibility when entering a step (without leading #). */
export function stepFocusTargetId(step: number): string {
  return `a4200-step-${step}-title`;
}
