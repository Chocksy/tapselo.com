// compare_pos_systems: Romanian POS vendors from src/lib/kb/competitors.json (neutral feature table).

import type { ToolDef } from "../types.ts";
import { cell, formatDateRo, normalize } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";
import { BUSINESS_TYPES } from "./checklist.ts";

const NAME = "compare_pos_systems";
export const EDITOR_NOTE =
  "Tabel întocmit de Tapselo (editor); Tapselo apare în listă ca orice alt furnizor, fără ordine preferențială.";

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
  receiving_photo?: unknown;
  fiscal_p7b_archive?: unknown;
  customer_offers?: unknown;
  ai_assistant?: unknown;
  pricing_public?: string | null;
  pricing_from?: string | null;
  notes?: string | null;
  sources?: { title: string; url: string }[];
  verified_on?: string;
}

export const NEEDS = {
  offline: { field: "offline", label: "Offline" },
  fiscal_printer: { field: "fiscal_printers", label: "Casa de marcat" },
  scales: { field: "scales", label: "Cântare" },
  recipes: { field: "recipes_production", label: "Rețete" },
  inventory: { field: "inventory", label: "Stocuri" },
  orders: { field: "ecommerce_or_orders", label: "Comenzi" },
  receiving_photo: { field: "receiving_photo", label: "Recepție din foto" },
  fiscal_p7b: { field: "fiscal_p7b_archive", label: "Arhivă .p7b" },
  customer_offers: { field: "customer_offers", label: "Oferte clienți" },
  ai_tools: { field: "ai_assistant", label: "Asistent AI" },
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

/** Alphabetical by vendor name (Romanian locale); no vendor pinned first. */
export function orderComparisonVendors<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

function sourcesMd(c: Competitor): string {
  const list = (c.sources ?? []).filter((s) => s?.url);
  if (!list.length) return "-";
  return list.map((s) => `[${cell(s.title || s.url)}](${s.url})`).join(", ");
}

function vendorAttribution(c: Competitor): { verified: string; sources: string } {
  return {
    verified: c.verified_on ? formatDateRo(c.verified_on) : "necunoscut",
    sources: sourcesMd(c),
  };
}

export function compareMd(list: Competitor[], type: string, needs: Need[], url: string): string {
  const cols = needs.length ? needs : (Object.keys(NEEDS) as Need[]);
  const ordered = orderComparisonVendors(list);
  const header = `| Program | ${cols.map((n) => NEEDS[n].label).join(" | ")} | Preț (public) |`;
  const sep = `|${" --- |".repeat(cols.length + 2)}`;
  const rows = ordered.map((c) => {
    const states = cols.map((n) => featureState((c as unknown as Record<string, unknown>)[NEEDS[n].field]));
    const price = c.pricing_from ?? c.pricing_public ?? "necunoscut";
    return `| [${cell(c.name)}](${c.url}) | ${states.map(mark).join(" | ")} | ${cell(price)} |`;
  });

  const factLines = ordered.flatMap((c) => {
    const { verified, sources } = vendorAttribution(c);
    const cols = needs.length ? needs : (Object.keys(NEEDS) as Need[]);
    const facts = cols.map((n) => {
      const val = mark(featureState((c as unknown as Record<string, unknown>)[NEEDS[n].field]));
      return `- ${NEEDS[n].label}: **${val}** — sursă: ${sources}; verificat: ${verified}`;
    });
    return [`**${c.name}**`, ...facts];
  });

  return [
    EDITOR_NOTE,
    "Fiecare afirmație din tabel folosește sursele furnizorului de pe rândul respectiv și data „verificat” de pe același rând (nu există surse separate per celulă în baza de date).",
    "",
    `Tip magazin: ${type.replace(/_/g, " ")}. Programele sunt listate în ordine alfabetică (locale ro).`,
    "",
    header,
    sep,
    ...rows,
    "",
    "### Surse și date de verificare (per program)",
    ...factLines,
    "",
    `Tabelul complet pe site: ${url}`,
  ].join("\n");
}

export function createCompareTool(list: Competitor[]): ToolDef {
  return {
    name: NAME,
    title: "Compara programe de casa de marcat / POS",
    description:
      "Compare Romanian POS / shop management software for a business type and optional needs (offline, cash register integration, scales, recipes, inventory, online orders, etc.). " +
      "Returns a markdown table of public feature claims with vendor verification dates and source links where available. " +
      "Tapselo maintains the table and is listed as one vendor among others; results are factual, not ranked endorsements.",
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
          maxItems: 10,
          description:
            "Cerinte: offline, fiscal_printer, scales, recipes, inventory, orders, receiving_photo, fiscal_p7b, customer_offers, ai_tools",
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
        return { text: `${EDITOR_NOTE} Comparatia nu este gata inca. Vezi: ${url}`, structured: { vendors: [], url } };
      }
      const cols = needs.length ? needs : (Object.keys(NEEDS) as Need[]);
      const ordered = orderComparisonVendors(list);
      return {
        text: compareMd(list, type, needs, url),
        structured: {
          editor_note: EDITOR_NOTE,
          ordering: "alphabetical_by_name_ro",
          business_type: type,
          needs: cols,
          vendors: ordered.map((c) => {
            const { verified, sources } = vendorAttribution(c);
            const sourceUrls = (c.sources ?? []).map((s) => s.url).filter(Boolean);
            return {
              name: c.name,
              url: c.url,
              verified_on: c.verified_on ?? null,
              sources: c.sources ?? [],
              features: Object.fromEntries(
                cols.map((n) => [
                  n,
                  {
                    value: featureState((c as unknown as Record<string, unknown>)[NEEDS[n].field]),
                    source_urls: sourceUrls,
                    verified_on: c.verified_on ?? null,
                  },
                ]),
              ),
              pricing: c.pricing_from ?? c.pricing_public ?? null,
              attribution: { sources_md: sources, verified },
            };
          }),
          url,
        },
      };
    },
  };
}
