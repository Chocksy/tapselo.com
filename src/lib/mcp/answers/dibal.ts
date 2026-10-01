// dibal_scale_help: Dibal scale topics from src/lib/kb/dibal.json.

import type { ToolDef } from "../types.ts";
import { searchEntries, type KbEntry } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { entryData, entryMd, readOnly } from "./kb.ts";

const NAME = "dibal_scale_help";
const PAGE = "/ghid/cantar-dibal";

export function createDibalHelpTool(entries: KbEntry[]): ToolDef {
  return {
    name: NAME,
    title: "Ajutor cantar Dibal",
    description:
      "Help for Dibal label scales (cantar Dibal D-500 / D-900, cantar cu eticheta) used with a POS: barcode format " +
      "28CCCCCWWWWWX (cod de bare cantar, PLU + greutate), PLU / cod cantar 1-999, cod de bare cu pret vs cu " +
      "greutate, setare eticheta, de ce nu se scaneaza codul de bare, configurare retea (IP PC, meniu 5 1 2) si " +
      "sincronizare produse din POS. To decode one barcode use decode_scale_barcode instead.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 300,
          description: "Problema sau intrebarea, de ex. \"cantarul nu primeste produsele\"",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      const hits = searchEntries(entries, String(args.query ?? ""), 3);
      const list = hits.length ? hits : entries.slice(0, 3);
      const intro = hits.length ? "" : "Nu am gasit un raspuns exact. Iata subiectele principale despre cantarele Dibal:\n\n";
      if (!list.length) {
        const url = trackedUrl(PAGE, NAME);
        return { text: `Ghidul pentru cantare Dibal: ${url}`, structured: { results: [], url } };
      }
      return {
        text: intro + list.map((e) => entryMd(e, NAME, PAGE)).join("\n\n---\n\n"),
        structured: { results: list.map((e) => entryData(e, NAME, PAGE)), exact: hits.length > 0 },
      };
    },
  };
}
