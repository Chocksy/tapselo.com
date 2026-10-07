import { isValidCuiCheckDigit, isValidNuiCheckDigit } from "../fiscal/check-digit.ts";
import type { CheckerIssue, CrossCheckInput } from "./types.ts";

function issue(
  code: string,
  title: string,
  ceInseamna: string,
  ceFaci: string,
  file?: string,
): CheckerIssue {
  return { severity: "error", code, title, ceInseamna, ceFaci, file };
}

/** Client-side CUI/NUI check digits (same rules as A4200Validator). */
export function runIdentifierChecks(input: CrossCheckInput): CheckerIssue[] {
  const out: CheckerIssue[] = [];
  const { opis, days, opisFiles } = input;
  if (!opis) return out;

  const opisFile = opisFiles[0];

  if (opis.cif && !isValidCuiCheckDigit(opis.cif)) {
    out.push(
      issue(
        "CUI_CHECK_DIGIT",
        "CUI cu cifră de control greșită",
        `Codul fiscal din opis (${opis.cif}) nu trece verificarea cifrei de control ANAF.`,
        "Verifică CUI-ul firmei în programul de casă și reexportă memoria fiscală. Dacă ai copiat manual numărul, compară cu certificatul de înregistrare.",
        opisFile,
      ),
    );
  }

  if (opis.nui && !isValidNuiCheckDigit(opis.nui)) {
    out.push(
      issue(
        "NUI_CHECK_DIGIT",
        "NUI cu cifră de control greșită",
        `Numărul unic al AMEF din opis (${opis.nui}) nu trece verificarea cifrei de control.`,
        "Nu modifica manual fișierele de pe stick. Cere service-ului reexportul perioadei sau verifică NUI-ul pe certificatul AMEF / în Registrul ANAF.",
        opisFile,
      ),
    );
  }

  for (const d of days) {
    if (d.parsed.cif && !isValidCuiCheckDigit(d.parsed.cif)) {
      out.push(
        issue(
          "CUI_CHECK_DIGIT",
          "CUI cu cifră de control greșită",
          `Ziua ${d.file} are CIF ${d.parsed.cif}, care nu trece verificarea cifrei de control.`,
          "Corectează datele firmei în casa de marcat și reexportă ziua fiscală.",
          d.file,
        ),
      );
    }
    if (d.parsed.nui && !isValidNuiCheckDigit(d.parsed.nui)) {
      out.push(
        issue(
          "NUI_CHECK_DIGIT",
          "NUI cu cifră de control greșită",
          `Ziua ${d.file} are NUI ${d.parsed.nui}, care nu trece verificarea cifrei de control AMEF.`,
          "Reexportă din memoria fiscală; nu edita manual XML-ul sau numele fișierelor.",
          d.file,
        ),
      );
    }
  }

  return out;
}
