import { formatZ, formatZRange } from "./check-summary.ts";
import { SUPPORTED_TIP_AMEF } from "./constants.ts";
import {
  checkSingleCalendarMonthAmongDays,
  dayCalendarPeriod,
  formatSegmentZRange,
  groupDaysByZ,
  splitDaysByMonth,
  type DayEntry,
} from "./day-groups.ts";
import { RO_MONTHS } from "./constants.ts";
import type { CheckerIssue, CrossCheckInput } from "./types.ts";

function issue(
  code: string,
  title: string,
  ceInseamna: string,
  ceFaci: string,
  file?: string,
  severity: CheckerIssue["severity"] = "error",
): CheckerIssue {
  return { severity, code, title, ceInseamna, ceFaci, file };
}

export function runCrossChecks(input: CrossCheckInput): CheckerIssue[] {
  const out: CheckerIssue[] = [];
  const { opis, days, foreign, opisFiles } = input;

  if (foreign.length > 0) {
    out.push(
      issue(
        "FOREIGN_FILES",
        "Fișiere străine în folder",
        `ANAF cere un folder cu doar opisul și zilele fiscale. Ai ${foreign.length} fișier(e) nerecunoscut(e).`,
        "Mută în alt folder orice PDF, recipisă, export vechi sau alt tip de fișier. Păstrează doar opisul (.p7b / .xml) și zilele (.p7b / .xml).",
      ),
    );
  }

  if (opisFiles.length > 1) {
    out.push(
      issue(
        "MULTIPLE_OPIS",
        "Mai multe opisuri în același export",
        "Ai încărcat mai mult de un fișier de tip opis (mReg) fără separare clară pe exporturi.",
        "Încarcă fiecare export lunar în arhivă sau folder separat (un opis + zilele lui), apoi verifică din nou.",
      ),
    );
  }

  if (!opis) {
    out.push(
      issue(
        "NO_OPIS",
        "Lipsește opisul",
        "Nu am găsit fișierul opis (rădăcină mReg) în selecție.",
        "Adaugă Perioada_raportare.p7b sau echivalentul XML semnat de casă.",
      ),
    );
    return out;
  }

  if (days.length === 0) {
    out.push(
      issue(
        "NO_DAYS",
        "Lipsesc zilele fiscale",
        "Opisul există, dar nu ai încărcat niciun fișier zi fiscală (msj).",
        "Adaugă toate fișierele 5000…_Zxxxx.p7b din perioada nrRapI–nrRapF.",
      ),
    );
  }

  if (opis.tipAmef === "S" || opis.tipAmef === "T") {
    out.push(
      issue(
        "TIP_AMEF_ST",
        "AMEF schimb valutar / taximetrie",
        `tip_amef=${opis.tipAmef} folosește A4201/A4202, nu A4203.`,
        "Pentru aceste aparate folosește validatoarele ANAF dedicate. Verificatorul Tapselo acoperă doar AMEF de uz general (U) și aeroporturi (A) în v1.",
      ),
    );
  } else if (!SUPPORTED_TIP_AMEF.has(opis.tipAmef)) {
    out.push(
      issue(
        "TIP_AMEF_UNSUPPORTED",
        "Tip AMEF necunoscut",
        `Valoarea tip_amef=${opis.tipAmef} nu este în lista U/A/S/T din schema.`,
        "Verifică exportul din casă sau contactează furnizorul AMEF.",
      ),
    );
  }

  const expectedCount = opis.nrRapF - opis.nrRapI + 1;
  if (expectedCount < 1) {
    out.push(
      issue(
        "Z_RANGE_INVALID",
        "Interval Z invalid în opis",
        `nrRapI (${opis.nrRapI}) este după nrRapF (${opis.nrRapF}).`,
        "Regenerează opisul din casă sau corectează perioada înainte de DUKIntegrator.",
      ),
    );
  }

  const dayEntries: DayEntry[] = days;
  const grouped = groupDaysByZ(dayEntries);

  const monthRef = checkSingleCalendarMonthAmongDays(dayEntries);
  if (dayEntries.length > 0) {
    const periods = dayEntries.map((d) => dayCalendarPeriod(d.parsed)).filter((p): p is { an: number; luna: number } => p !== null);
    const mixedMonths = periods.length > 1 && monthRef === null;
    if (mixedMonths) {
      const segments = splitDaysByMonth(dayEntries);
      const sample = segments
        .map((s) => `${RO_MONTHS[s.luna - 1]} ${s.an} (${formatSegmentZRange(s)})`)
        .join("; ");
      out.push(
        issue(
          "PERIOD_MISMATCH",
          "Zile din luni diferite",
          `Nu toate zilele fiscale sunt din aceeași lună calendaristică: ${sample}.`,
          "Cere service-ului exporturi separate din casă, câte una pe lună calendaristică, fiecare cu opisul semnat pentru intervalul Z respectiv.",
        ),
      );
    }
  }

  for (const dup of grouped.duplicateZ) {
    out.push(
      issue(
        "DUPLICATE_Z",
        "Raport Z duplicat",
        `${formatZ(dup.z)} apare în mai multe fișiere: ${dup.files}.`,
        "Păstrează o singură zi fiscală per număr Z (sau o pereche .p7b + .xml pentru același Z).",
      ),
    );
  }

  for (const d of dayEntries) {
    if (d.parsed.nui !== opis.nui) {
      out.push(
        issue(
          "NUI_MISMATCH",
          "NUI diferit față de opis",
          `Ziua ${d.file} are NUI ${d.parsed.nui}, opisul are ${opis.nui}.`,
          "Toate fișierele trebuie să provină de pe același aparat. Refă exportul din memoria fiscală a AMEF-ului corect.",
          d.file,
        ),
      );
    }

    if (d.parsed.cif && d.parsed.cif !== opis.cif) {
      out.push(
        issue(
          "CIF_MISMATCH",
          "CIF diferit față de opis",
          `Ziua ${d.file} are CIF ${d.parsed.cif}, opisul are ${opis.cif}.`,
          "Verifică că nu ai amestecat exporturi de la două firme sau două case.",
          d.file,
        ),
      );
    }

    const z = d.parsed.zReport;
    if (z < opis.nrRapI || z > opis.nrRapF) {
      out.push(
        issue(
          "Z_OUT_OF_RANGE",
          "Raport Z în afara opisului",
          `Ziua ${d.file} este raportul ${formatZ(z)}, dar opisul acoperă ${formatZRange(opis)}.`,
          "Scoate zilele din afara perioadei sau regenerează opisul cu nrRapI/nrRapF corecte.",
          d.file,
        ),
      );
    }
  }

  if (expectedCount > 0 && grouped.uniqueZ.size > 0) {
    const missing: number[] = [];
    for (let z = opis.nrRapI; z <= opis.nrRapF; z++) {
      if (!grouped.uniqueZ.has(z)) missing.push(z);
    }
    if (missing.length > 0) {
      const sample = missing.slice(0, 8).map((z) => formatZ(z)).join(", ");
      const more = missing.length > 8 ? ` (+${missing.length - 8})` : "";
      out.push(
        issue(
          "MISSING_Z",
          "Lipsesc zile fiscale",
          `Opisul cere ${expectedCount} zile (${formatZRange(opis)}), ai ${grouped.uniqueZ.size} rapoarte Z distincte. Lipsesc: ${sample}${more}.`,
          "Reexportă zilele lipsă din casa de marcat sau verifică că ai dezarhivat toate .p7b din arhivă.",
        ),
      );
    }

    if (grouped.uniqueZ.size !== expectedCount && missing.length === 0) {
      out.push(
        issue(
          "Z_COUNT_MISMATCH",
          "Număr de zile nepotrivit",
          `Opisul cere ${expectedCount} rapoarte Z, dar ai ${grouped.uniqueZ.size} numere Z distincte în fișiere.`,
          "Verifică intervalul nrRapI–nrRapF și lista de fișiere încărcate.",
        ),
      );
    }
  }

  return out;
}
