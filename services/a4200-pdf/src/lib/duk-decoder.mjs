import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const kb = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../data/a4200-errors.json"), "utf8"),
);

export function decodeDukErrTxt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((raw) => {
    for (const rule of kb.duk_rules) {
      if (new RegExp(rule.pattern, "i").test(raw)) {
        const e = kb.crosscheck[rule.code];
        if (e) {
          return {
            raw,
            explained: true,
            code: rule.code,
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
