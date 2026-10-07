import { isP7bXmlPairForZ } from "./day-groups.ts";
import { explainXsdMessage, a4200Kb } from "./explain.ts";
import { zFromAmefId, zFromFileName } from "./parse.ts";
import type { CheckerIssue } from "./types.ts";

export type XsdFileInput = { name: string; xml: string; schema: string };

function isOpisXml(xml: string): boolean {
  return /<(?:[\w.-]+:)?mReg[\s>/]/.test(xml);
}

function zForXsdFile(f: XsdFileInput): number | null {
  const fromName = zFromFileName(f.name);
  if (fromName !== null) return fromName;
  const m = f.xml.match(/idM="([^"]+)"/);
  if (m) return zFromAmefId(m[1]);
  return null;
}

/** When the same Z is uploaded as .p7b and .xml, validate XSD once (prefer .p7b). */
export function dedupePairedDayFilesForXsd(files: XsdFileInput[]): XsdFileInput[] {
  const opis = files.filter((f) => isOpisXml(f.xml));
  const days = files.filter((f) => !isOpisXml(f.xml));
  const byZ = new Map<number, XsdFileInput[]>();
  const ungrouped: XsdFileInput[] = [];

  for (const f of days) {
    const z = zForXsdFile(f);
    if (z === null) {
      ungrouped.push(f);
      continue;
    }
    const list = byZ.get(z) ?? [];
    list.push(f);
    byZ.set(z, list);
  }

  const picked: XsdFileInput[] = [...opis];
  for (const [z, list] of byZ) {
    if (list.length === 2 && isP7bXmlPairForZ(list.map((x) => x.name), z)) {
      const p7b = list.find((x) => x.name.toLowerCase().endsWith(".p7b"));
      picked.push(p7b ?? list[0]);
    } else {
      picked.push(...list);
    }
  }
  picked.push(...ungrouped);
  return picked;
}

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
  files: XsdFileInput[],
): Promise<CheckerIssue[]> {
  const issues: CheckerIssue[] = [];
  for (const f of dedupePairedDayFilesForXsd(files)) {
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
