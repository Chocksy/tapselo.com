import { explainXsdMessage } from "./explain.ts";
import type { CheckerIssue } from "./types.ts";

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
  return issues;
}
