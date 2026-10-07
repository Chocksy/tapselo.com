import { runCrossChecks } from "./crosscheck.ts";
import { runIdentifierChecks } from "./identifier-checks.ts";
import { explainParseError } from "./explain.ts";
import type { ClassifiedFile, CheckerIssue, CrossCheckInput, ParsedDay, ParsedOpis } from "./types.ts";
import { parseDayXml, parseOpisXml } from "./parse.ts";

export function buildCrossCheckInput(files: ClassifiedFile[]): {
  input: CrossCheckInput;
  parseIssues: CheckerIssue[];
} {
  const parseIssues: CheckerIssue[] = [];
  let opis: ParsedOpis | null = null;
  const opisFiles: string[] = [];
  const days: { file: string; parsed: ParsedDay }[] = [];
  const foreign: string[] = [];

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
        opisFiles.push(f.name);
        opis = parseOpisXml(f.xml);
      } else if (f.kind === "day") {
        days.push({ file: f.name, parsed: parseDayXml(f.xml, f.name) });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare XML";
      parseIssues.push(explainParseError(msg, f.name));
    }
  }

  return {
    input: { opis, days, foreign, opisFiles },
    parseIssues,
  };
}

export function runLocalChecks(files: ClassifiedFile[]): CheckerIssue[] {
  const { input, parseIssues } = buildCrossCheckInput(files);
  return [...parseIssues, ...runIdentifierChecks(input), ...runCrossChecks(input)];
}
