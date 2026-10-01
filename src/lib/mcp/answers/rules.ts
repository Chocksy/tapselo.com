// search_business_rules: Romanian business rules from src/lib/kb/rules.json.

import type { ToolDef } from "../types.ts";
import { searchEntries, type KbEntry } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { entryData, entryMd, readOnly } from "./kb.ts";

const NAME = "search_business_rules";

export function createSearchRulesTool(entries: KbEntry[]): ToolDef {
  return {
    name: NAME,
    title: "Reguli pentru magazine (TVA, casa de marcat, ANAF)",
    description:
      "Search verified Romanian business rules for small shops and answer with official sources. Use for questions " +
      "about TVA / cota TVA (21%, 11%), grupa TVA pe casa de marcat, plafon TVA, microintreprindere, plafon numerar " +
      "(casa, registru de casa), raport Z, memorie fiscala, e-Factura, SAF-T D406, NIR, pret pe kg/litru, pret " +
      "barat / reducere, garantie SGR / RetuRO, alergeni, e-Transport. Input is the question in Romanian or English.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 300,
          description: "Intrebarea, de ex. \"ce grupa TVA pun pentru paine pe casa de marcat\"",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      const query = String(args.query ?? "");
      const hits = searchEntries(entries, query, 3);
      if (!hits.length) {
        const url = trackedUrl("/ghid", NAME);
        return {
          text: `Nu am gasit o regula potrivita in ghidul Tapselo pentru aceasta intrebare. Vezi toate ghidurile: ${url}`,
          structured: { results: [], url },
        };
      }
      return {
        text: hits.map((e) => entryMd(e, NAME)).join("\n\n---\n\n"),
        structured: { results: hits.map((e) => entryData(e, NAME)) },
      };
    },
  };
}
