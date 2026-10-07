import { formatZ, type OpisCheckSummary } from "./check-summary.ts";
import { periodFromIdM } from "./parse.ts";
import type { CheckerIssue, ParsedOpis } from "./types.ts";

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

export const RO_MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

export function resolveOpisPeriod(opis: ParsedOpis): { an: number; luna: number } | null {
  if (opis.an != null && opis.luna != null) return { an: opis.an, luna: opis.luna };
  return periodFromIdM(opis.idM);
}

export function formatPeriodLabel(opis: ParsedOpis): string | null {
  const p = resolveOpisPeriod(opis);
  if (!p) return null;
  return `${RO_MONTHS[p.luna - 1]} ${p.an}`;
}

export function formatZRangePlain(nrRapI: number, nrRapF: number): string {
  return `Z ${nrRapI}–${nrRapF}`;
}

export interface VerificationPlainSummary {
  ok: boolean;
  errorCount: number;
  headline: string;
  foundLine: string | null;
  missingLines: string[];
  periodLabel: string | null;
}

export function buildVerificationPlainSummary(
  summary: OpisCheckSummary | null,
  issues: CheckerIssue[],
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
    };
  }

  const periodLabel = formatPeriodLabel(summary.opis);
  const zPlain = formatZRangePlain(summary.opis.nrRapI, summary.opis.nrRapF);
  const complete = summary.presentCount === summary.expectedCount && errorCount === 0;
  const ok = complete;

  let foundLine: string;
  if (summary.presentCount === summary.expectedCount) {
    foundLine = periodLabel
      ? `Am găsit rapoartele ${zPlain} pentru ${periodLabel}.`
      : `Am găsit toate rapoartele ${zPlain} (${summary.expectedCount} zile).`;
  } else {
    foundLine = periodLabel
      ? `Am găsit ${summary.presentCount} din ${summary.expectedCount} rapoarte pentru ${periodLabel} (interval ${zPlain}).`
      : `Am găsit ${summary.presentCount} din ${summary.expectedCount} rapoarte (${zPlain}).`;
  }

  const missing = summary.rows.filter((r) => r.status === "missing");
  const missingLines = missing.map(
    (r) =>
      `Lipsește raportul ${formatZ(r.z)} — cere service-ului reexportul zilei sau verifică stick-ul de la casă.`,
  );

  let headline: string;
  if (ok) {
    headline = "Totul arată în regulă pentru depunere.";
  } else if (missing.length > 0) {
    headline = "Lipsesc zile din exportul de la casă.";
  } else if (errorCount > 0) {
    headline = "Trebuie corectate unele probleme înainte de PDF.";
  } else {
    headline = "Verifică lista de mai jos.";
  }

  return { ok, errorCount, headline, foundLine, missingLines, periodLabel };
}

export function canProceedToPdfStep(plain: VerificationPlainSummary): boolean {
  return plain.ok;
}

export interface WizardButtonContext {
  hasFiles?: boolean;
  checksOk?: boolean;
  onStep3ReadyForAnaf?: boolean;
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
