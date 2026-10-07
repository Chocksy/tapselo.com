import a4200Kb from "../kb/a4200-errors.json" with { type: "json" };
import type { CheckerIssue } from "./types.ts";

type KbEntry = { title: string; ce_inseamna: string; ce_faci: string };
type XsdRule = { pattern: string; code: string };
type Kb = {
  crosscheck: Record<string, KbEntry>;
  xsd_rules: XsdRule[];
  xsd_fallback: KbEntry;
  parse_rules?: { pattern: string; code: string }[];
  duk_rules: { pattern: string; code: string }[];
  duk_fallback: KbEntry;
};

const kb = a4200Kb as Kb;

function fromKb(code: string, file?: string, line?: number, field?: string): CheckerIssue {
  const e = kb.crosscheck[code] ?? kb.xsd_fallback;
  return {
    severity: "error",
    code,
    title: e.title,
    ceInseamna: e.ce_inseamna,
    ceFaci: e.ce_faci,
    file,
    line,
    field,
  };
}

export function explainCrossCheck(code: string, file?: string): CheckerIssue {
  return fromKb(code, file);
}

export function explainXsdMessage(raw: string, file?: string, line?: number): CheckerIssue {
  for (const rule of kb.xsd_rules) {
    if (new RegExp(rule.pattern, "i").test(raw)) {
      const e = kb.crosscheck[rule.code] ?? kb.xsd_fallback;
      return {
        severity: "error",
        code: rule.code,
        title: e.title,
        ceInseamna: e.ce_inseamna,
        ceFaci: e.ce_faci,
        file,
        line,
      };
    }
  }
  const e = kb.xsd_fallback;
  return {
    severity: "error",
    code: "XSD_OTHER",
    title: e.title,
    ceInseamna: e.ce_inseamna,
    ceFaci: e.ce_faci,
    file,
    line,
  };
}

export function explainParseError(message: string, file: string): CheckerIssue {
  for (const rule of kb.parse_rules ?? []) {
    if (new RegExp(rule.pattern, "i").test(message)) {
      const e = kb.crosscheck[rule.code] ?? kb.crosscheck.PARSE_ERROR;
      return {
        severity: "error",
        code: rule.code,
        title: e.title,
        ceInseamna: e.ce_inseamna,
        ceFaci: e.ce_faci,
        file,
      };
    }
  }
  const e = kb.crosscheck.PARSE_ERROR;
  return {
    severity: "error",
    code: "PARSE_ERROR",
    title: e.title,
    ceInseamna: e.ce_inseamna,
    ceFaci: e.ce_faci,
    file,
  };
}

export function explainP7bExtractFailed(file: string): CheckerIssue {
  const e = kb.crosscheck.P7B_EXTRACT_FAILED;
  return {
    severity: "error",
    code: "P7B_EXTRACT_FAILED",
    title: e.title,
    ceInseamna: e.ce_inseamna,
    ceFaci: e.ce_faci,
    file,
  };
}

export { kb as a4200Kb };
