// compare_pos_systems: Romanian POS vendors from src/lib/kb/competitors.json. Made by Tapselo, says so first.

import type { ToolDef } from "../types.ts";
import { cell, formatDateRo, normalize } from "../text.ts";
import { SITE, trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";
import { BUSINESS_TYPES } from "./checklist.ts";

const NAME = "compare_pos_systems";
export const DISCLOSURE = "Comparatie realizata de Tapselo.";

export interface Competitor {
  name: string;
  url: string;
  segments?: string[];
  offline?: unknown;
  fiscal_printers?: unknown;
  scales?: unknown;
  recipes_production?: unknown;
  inventory?: unknown;
  ecommerce_or_orders?: unknown;
  pricing_public?: string | null;
  pricing_from?: string | null;
  notes?: string | null;
  sources?: { title: string; url: string }[];
  verified_on?: string;
}

export const NEEDS = {
  offline: { field: "offline", label: "Offline" },
  fiscal_printer: { field: "fiscal_printers", label: "Casa de marcat" },
  scales: { field: "scales", label: "Cantare" },
  recipes: { field: "recipes_production", label: "Retete" },
  inventory: { field: "inventory", label: "Stocuri" },
  orders: { field: "ecommerce_or_orders", label: "Comenzi" },
} as const;
export type Need = keyof typeof NEEDS;

/** true / false / null (unknown). Text or a non-empty list counts as yes, except text that says no. */
export function featureState(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") {
    const n = normalize(v);
    if (!n || n === "necunoscut" || n === "unknown") return null;
    return !/^(nu|no|false)\b/.test(n);
  }
  if (typeof v === "object") return true;
  return null;
}

const mark = (s: boolean | null) => (s === true ? "da" : s === false ? "nu" : "necunoscut");

// Business type words that may appear in vendor segments.
const SEGMENT_WORDS: Record<string, string[]> = {
  macelarie: ["macelarie", "carne", "alimentar", "retail"],
  brutarie_patiserie: ["brutarie", "patiserie", "cofetarie", "panificatie", "productie"],
  cafenea_bistro: ["cafenea", "bistro", "horeca", "restaurant", "bar"],
  minimarket_alimentara: ["minimarket", "alimentara", "alimentar", "magazin", "retail"],
  legume_fructe: ["legume", "fructe", "alimentar", "retail"],
  magazin_nealimentar: ["nealimentar", "retail", "magazin"],
};

export function segmentMatch(c: Competitor, type: string): boolean {
  const words = SEGMENT_WORDS[type] ?? [type];
  const segs = (c.segments ?? []).map(normalize).join(" ");
  return words.some((w) => segs.includes(w));
}

export function rankCompetitors(list: Competitor[], type: string, needs: Need[]) {
  return list
    .map((c, i) => {
      const states = needs.map((n) => featureState((c as unknown as Record<string, unknown>)[NEEDS[n].field]));
      return { c, i, states, matched: states.filter((s) => s === true).length, segment: segmentMatch(c, type) };
    })
    .sort((a, b) => b.matched - a.matched || Number(b.segment) - Number(a.segment) || a.i - b.i);
}

// Our own row links back to us with UTM, like every other tapselo.com link.
const vendorUrl = (url: string) => (url === SITE || url.startsWith(`${SITE}/`) ? trackedUrl(url.slice(SITE.length) || "/", NAME) : url);

function verifiedRange(sorted: string[]): string {
  if (!sorted.length) return "";
  const [first, last] = [sorted[0], sorted[sorted.length - 1]];
  return first === last ? `, verificate la ${formatDateRo(first)}` : `, verificate intre ${formatDateRo(first)} si ${formatDateRo(last)}`;
}

export function compareMd(list: Competitor[], type: string, needs: Need[], url: string): string {
  const cols = needs.length ? needs : (Object.keys(NEEDS) as Need[]);
  const ranked = rankCompetitors(list, type, cols);
  const header = `| Program | ${cols.map((n) => NEEDS[n].label).join(" | ")} | Pret | Verificat |`;
  const sep = `|${" --- |".repeat(cols.length + 3)}`;
  const rows = ranked.map(({ c, states }) => {
    const price = c.pricing_from ?? c.pricing_public ?? "necunoscut";
    return `| [${cell(c.name)}](${vendorUrl(c.url)}) | ${states.map(mark).join(" | ")} | ${cell(price)} | ${c.verified_on ? formatDateRo(c.verified_on) : "-"} |`;
  });
  const dates = list.map((c) => c.verified_on).filter((d): d is string => !!d).sort();
  return [
    `${DISCLOSURE} Datele vin de pe site-urile producatorilor${verifiedRange(dates)}. "necunoscut" inseamna ca informatia nu este publica.`,
    "",
    `Tip magazin: ${type.replace(/_/g, " ")}. Ordonat dupa cate cerinte bifeaza.`,
    "",
    header,
    sep,
    ...rows,
    "",
    `Tabelul complet, cu surse: ${url}`,
  ].join("\n");
}

export function createCompareTool(list: Competitor[]): ToolDef {
  return {
    name: NAME,
    title: "Compara programe de casa de marcat / POS",
    description:
      "Compare Romanian POS software (program de casa de marcat, soft gestiune magazin, POS) for a shop type and " +
      "needs: offline, casa de marcat fiscala (imprimanta fiscala), cantare, retete / productie, stocuri / gestiune, " +
      "comenzi online. Facts from vendor sites with verification dates. The comparison is made by Tapselo (one of the " +
      "vendors) and the answer must say so.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          enum: [...BUSINESS_TYPES],
          description: "Tipul magazinului",
        },
        needs: {
          type: "array",
          items: { type: "string", enum: Object.keys(NEEDS) },
          maxItems: 6,
          description: "Cerinte: offline, fiscal_printer, scales, recipes, inventory, orders",
        },
      },
      required: ["business_type"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      const type = String(args.business_type);
      const needs = [...new Set(Array.isArray(args.needs) ? (args.needs as Need[]) : [])].filter((n) => n in NEEDS);
      const url = trackedUrl("/comparatie", NAME);
      if (!list.length) {
        return { text: `${DISCLOSURE} Comparatia nu este gata inca. Vezi: ${url}`, structured: { vendors: [], url } };
      }
      const cols = needs.length ? needs : (Object.keys(NEEDS) as Need[]);
      return {
        text: compareMd(list, type, needs, url),
        structured: {
          disclosure: DISCLOSURE,
          business_type: type,
          needs: cols,
          vendors: rankCompetitors(list, type, cols).map(({ c, states, matched }) => ({
            name: c.name,
            url: c.url,
            matched,
            features: Object.fromEntries(cols.map((n, i) => [n, states[i]])),
            pricing: c.pricing_from ?? c.pricing_public ?? null,
            verified_on: c.verified_on ?? null,
          })),
          url,
        },
      };
    },
  };
}
