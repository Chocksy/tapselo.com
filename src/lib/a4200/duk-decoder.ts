import a4200Kb from "../kb/a4200-errors.json" with { type: "json" };
import type { ErrTxtLine } from "./types.ts";

type Kb = {
  duk_rules: { pattern: string; code: string }[];
  duk_fallback: { title: string; ce_inseamna: string; ce_faci: string };
  crosscheck: Record<string, { title: string; ce_inseamna: string; ce_faci: string }>;
};

const kb = a4200Kb as Kb;

export function decodeDukErrTxt(text: string): ErrTxtLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((raw) => {
    for (const rule of kb.duk_rules) {
      if (new RegExp(rule.pattern, "i").test(raw)) {
        const e = kb.crosscheck[rule.code];
        if (e) {
          return {
            raw,
            explained: true,
            title: e.title,
            ceInseamna: e.ce_inseamna,
            ceFaci: e.ce_faci,
          };
        }
      }
    }
    const fb = kb.duk_fallback;
    return {
      raw,
      explained: false,
      title: fb.title,
      ceInseamna: raw,
      ceFaci: fb.ce_faci,
    };
  });
}
