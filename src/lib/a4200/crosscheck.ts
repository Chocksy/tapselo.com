import { SUPPORTED_TIP_AMEF } from "./constants.ts";
import { periodFromIdM } from "./parse.ts";
import type { CheckerIssue, CrossCheckInput, ParsedOpis } from "./types.ts";

function issue(
  code: string,
  title: string,
  ceInseamna: string,
  ceFaci: string,
  file?: string,
): CheckerIssue {
  return { severity: "error", code, title, ceInseamna, ceFaci, file };
}

function opisPeriod(opis: ParsedOpis): { an: number; luna: number } | null {
  if (opis.an !== undefined && opis.luna !== undefined) return { an: opis.an, luna: opis.luna };
  return periodFromIdM(opis.idM);
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
        "Mai multe opisuri",
        "Ai încărcat mai mult de un fișier de tip opis (mReg).",
        "Păstrează un singur opis pentru perioada raportată și șterge duplicatele.",
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

  const period = opisPeriod(opis);
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

  const zSeen = new Map<number, string>();
  for (const d of days) {
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

    if (period) {
      const dayPeriod =
        d.parsed.an !== undefined && d.parsed.luna !== undefined
          ? { an: d.parsed.an, luna: d.parsed.luna }
          : periodFromIdM(d.parsed.idM);
      if (dayPeriod && (dayPeriod.an !== period.an || dayPeriod.luna !== period.luna)) {
        out.push(
          issue(
            "PERIOD_MISMATCH",
            "Lună/an diferit față de opis",
            `Ziua ${d.file} pare din ${dayPeriod.luna}/${dayPeriod.an}, opisul din ${period.luna}/${period.an}.`,
            "Raportează o singură perioadă calendaristică. Separă lunile în foldere diferite.",
            d.file,
          ),
        );
      }
    }

    const z = d.parsed.zReport;
    if (z < opis.nrRapI || z > opis.nrRapF) {
      out.push(
        issue(
          "Z_OUT_OF_RANGE",
          "Raport Z în afara opisului",
          `Ziua ${d.file} este raportul Z${z}, dar opisul acoperă Z${opis.nrRapI}–Z${opis.nrRapF}.`,
          "Scoate zilele din afara perioadei sau regenerează opisul cu nrRapI/nrRapF corecte.",
          d.file,
        ),
      );
    }

    const prev = zSeen.get(z);
    if (prev) {
      out.push(
        issue(
          "DUPLICATE_Z",
          "Raport Z duplicat",
          `Z${z} apare în ${prev} și în ${d.file}.`,
          "Păstrează o singură zi fiscală per număr Z.",
          d.file,
        ),
      );
    } else {
      zSeen.set(z, d.file);
    }
  }

  if (expectedCount > 0 && days.length > 0) {
    const missing: number[] = [];
    for (let z = opis.nrRapI; z <= opis.nrRapF; z++) {
      if (!zSeen.has(z)) missing.push(z);
    }
    if (missing.length > 0) {
      const sample = missing.slice(0, 8).map((z) => `Z${z}`).join(", ");
      const more = missing.length > 8 ? ` (+${missing.length - 8})` : "";
      out.push(
        issue(
          "MISSING_Z",
          "Lipsesc zile fiscale",
          `Opisul cere ${expectedCount} zile (Z${opis.nrRapI}–Z${opis.nrRapF}), ai ${days.length}. Lipsesc: ${sample}${more}.`,
          "Reexportă zilele lipsă din casa de marcat sau verifică că ai dezarhivat toate .p7b din arhivă.",
        ),
      );
    }

    if (days.length !== expectedCount && missing.length === 0) {
      out.push(
        issue(
          "Z_COUNT_MISMATCH",
          "Număr de zile nepotrivit",
          `Opisul cere ${expectedCount} zile, dar ai ${days.length} fișiere zi fiscală (fără duplicate).`,
          "Verifică intervalul nrRapI–nrRapF și lista de fișiere încărcate.",
        ),
      );
    }
  }

  return out;
}
