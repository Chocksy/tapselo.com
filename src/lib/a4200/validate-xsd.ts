import { explainXsdMessage, a4200Kb } from "./explain.ts";
import type { CheckerIssue } from "./types.ts";

const VAT_XSD_CODES = new Set(["XSD_COTA_NEW_VAT", "XSD_COTA_ENUM"]);

/** Collapse thousands of 11%/21% cota enumeration errors into one warning. */
export function collapseVatXsdWarnings(issues: CheckerIssue[]): CheckerIssue[] {
  let vatHits = 0;
  const rest: CheckerIssue[] = [];
  for (const i of issues) {
    if (VAT_XSD_CODES.has(i.code)) vatHits++;
    else rest.push(i);
  }
  if (vatHits === 0) return rest;
  const e = a4200Kb.crosscheck.XSD_COTA_NEW_VAT;
  rest.push({
    severity: "warning",
    code: "XSD_COTA_NEW_VAT",
    title: e.title,
    ceInseamna: `Am găsit ${vatHits} mențiuni de cote TVA 11% sau 21% în bonuri. Schema XSD publică din 2018 nu le include; validatorul ANAF actualizat le acceptă de obicei la depunere.`,
    ceFaci: e.ce_faci,
  });
  return rest;
}

export type XsdValidateFn = (opts: {
  xml: { fileName: string; contents: string }[];
  schema: string[];
}) => Promise<{ valid: boolean; errors?: { message?: string; rawMessage?: string; loc?: { lineNumber?: number } }[] }>;

export async function validateAgainstXsd(
  validateXML: XsdValidateFn,
  files: { name: string; xml: string; schema: string }[],
): Promise<CheckerIssue[]> {
  const issues: CheckerIssue[] = [];
  for (const f of files) {
    const result = await validateXML({
      xml: [{ fileName: f.name, contents: f.xml }],
      schema: [f.schema],
    });
    if (result.valid) continue;
    for (const err of result.errors ?? []) {
      const msg = err.message ?? err.rawMessage ?? "Eroare XSD";
      const line = err.loc?.lineNumber;
      issues.push(explainXsdMessage(msg, f.name, line));
    }
  }
  return collapseVatXsdWarnings(issues);
}
