import { buildOpisCheckSummary, formatZ } from "./check-summary.ts";
import { periodFromIdM } from "./parse.ts";
import type { CheckerIssue, CrossCheckInput, ParsedOpis } from "./types.ts";

const LUNI_RO = [
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

export function formatPerioadaRo(an: number, luna: number): string {
  const name = LUNI_RO[luna - 1];
  return name ? `${name} ${an}` : `${luna}/${an}`;
}

export function resolveOpisPeriod(opis: ParsedOpis): { an: number; luna: number } | null {
  if (opis.an !== undefined && opis.luna !== undefined) {
    return { an: opis.an, luna: opis.luna };
  }
  return periodFromIdM(opis.idM);
}

export interface WizardStep2View {
  ok: boolean;
  headline: string;
  detailLines: string[];
  missingZ: number[];
  errorCount: number;
  warningCount: number;
}

/** Local cross-check only — XSD warnings on zile (cote 11%/21%) nu blochează continuarea în wizard. */
export function buildWizardStep2View(input: CrossCheckInput, localIssues: CheckerIssue[]): WizardStep2View {
  const summary = buildOpisCheckSummary(input);
  const errors = localIssues.filter((i) => i.severity === "error");
  const warnings = localIssues.filter((i) => i.severity === "warning");
  const detailLines: string[] = [];

  if (!input.opis || !summary) {
    return {
      ok: false,
      headline: "Nu am găsit opisul perioadei în fișierele încărcate.",
      detailLines: [
        "Cere service-ului arhiva completă de la casă sau adaugă fișierul Perioada_raportare.p7b.",
      ],
      missingZ: [],
      errorCount: errors.length,
      warningCount: warnings.length,
    };
  }

  const period = resolveOpisPeriod(input.opis);
  const periodLabel = period ? ` pentru ${formatPerioadaRo(period.an, period.luna)}` : "";
  const zSpan = `${formatZ(input.opis.nrRapI)}–${formatZ(input.opis.nrRapF)}`;
  const missingZ = summary.rows.filter((r) => r.status === "missing").map((r) => r.z);

  if (errors.length === 0 && missingZ.length === 0) {
    return {
      ok: true,
      headline: `Totul arată în regulă. Am găsit rapoartele ${zSpan}${periodLabel}.`,
      detailLines: [
        `Ai toate cele ${summary.expectedCount} zile cerute de opis.`,
        "Poți continua la generarea PDF-ului pentru semnare.",
      ],
      missingZ: [],
      errorCount: 0,
      warningCount: warnings.length,
    };
  }

  const parts: string[] = [];
  if (missingZ.length > 0) {
    const list = missingZ.map((z) => formatZ(z)).join(", ");
    parts.push(`Lipsesc rapoartele ${list}.`);
    detailLines.push("Reexportă zilele lipsă din memoria fiscală sau cere din nou arhiva de la service.");
  } else if (summary.presentCount < summary.expectedCount) {
    parts.push(`Ai ${summary.presentCount} din ${summary.expectedCount} zile cerute de opis.`);
  }

  if (errors.length > 0) {
    parts.push(
      errors.length === 1
        ? "Am găsit o problemă care trebuie rezolvată înainte de depunere."
        : `Am găsit ${errors.length} probleme care trebuie rezolvate înainte de depunere.`,
    );
  }

  const foundLine = `Am găsit rapoartele ${zSpan}${periodLabel}, dar declarația nu este completă.`;

  return {
    ok: false,
    headline: parts.length > 0 ? `${foundLine} ${parts.join(" ")}` : foundLine,
    detailLines,
    missingZ,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

export const WIZARD_STEP_COUNT = 4;

export function wizardProgressLabel(step: number): string {
  const n = Math.min(Math.max(1, step), WIZARD_STEP_COUNT);
  return `Pasul ${n} din ${WIZARD_STEP_COUNT}`;
}
