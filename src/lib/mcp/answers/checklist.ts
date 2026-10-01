// open_shop_checklist: what a new shop needs, per business type (src/lib/kb/shop-checklists.json).

import type { ToolDef } from "../types.ts";
import { formatDateRo } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";

const NAME = "open_shop_checklist";

export const BUSINESS_TYPES = [
  "macelarie",
  "brutarie_patiserie",
  "cafenea_bistro",
  "minimarket_alimentara",
  "legume_fructe",
  "magazin_nealimentar",
] as const;

export const pageFor = (t: string) => `/ghid/deschide-${t.replace(/_/g, "-")}`;

type Source = { title: string; url: string };

/** One entry of shop-checklists.json. */
export interface Checklist {
  id: string;
  business_type: string;
  title: string;
  summary: string;
  caen: { code: string; label: string }[];
  steps: { title: string; body: string; authority?: string; sources?: Source[] }[];
  fiscal: string[];
  documents: string[];
  keywords: string[];
  verified_on: string;
  page: string;
}

export function findChecklist(entries: Checklist[], type: string): Checklist | null {
  return entries.find((e) => e.business_type === type) ?? null;
}

/** Unique sources of all steps, in order. */
export function checklistSources(e: Checklist): Source[] {
  const seen = new Set<string>();
  return e.steps.flatMap((s) => s.sources ?? []).filter((s) => !seen.has(s.url) && !!seen.add(s.url));
}

const linkList = (sources: Source[] | undefined) =>
  (sources ?? []).map((s) => `[${s.title || s.url}](${s.url})`).join(", ");

export function checklistMd(e: Checklist, url: string): string {
  const parts = [`### ${e.title}`, e.summary];
  if (e.caen?.length) parts.push(`**Coduri CAEN**\n${e.caen.map((c) => `- ${c.code} - ${c.label}`).join("\n")}`);
  if (e.steps?.length) {
    const steps = e.steps.map((s, i) => {
      const src = linkList(s.sources);
      return `${i + 1}. **${s.title}**${s.authority ? ` (${s.authority})` : ""}\n   ${s.body}${src ? `\n   Surse: ${src}` : ""}`;
    });
    parts.push(`**Pasi**\n${steps.join("\n")}`);
  }
  if (e.fiscal?.length) parts.push(`**Obligatii fiscale**\n${e.fiscal.map((x) => `- ${x}`).join("\n")}`);
  if (e.documents?.length) parts.push(`**Documente de pastrat**\n${e.documents.map((x) => `- ${x}`).join("\n")}`);
  if (e.verified_on) parts.push(`Verificat la ${formatDateRo(e.verified_on)}.`);
  parts.push(`Detalii: ${url}`);
  return parts.join("\n\n");
}

export function createChecklistTool(entries: Checklist[]): ToolDef {
  return {
    name: NAME,
    title: "Ce iti trebuie ca sa deschizi un magazin",
    description:
      "Checklist for opening a small shop in Romania by business type: coduri CAEN, autorizatii (ONRC, DSV / ANSVSA, " +
      "DSP, ISU, primarie, mediu), casa de marcat, SGR, documents to keep, with official sources. Use for \"vreau sa " +
      "deschid o macelarie / brutarie / cafenea / alimentara / magazin de legume-fructe / magazin nealimentar, ce " +
      "autorizatii imi trebuie\".",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          enum: [...BUSINESS_TYPES],
          description:
            "macelarie, brutarie_patiserie, cafenea_bistro, minimarket_alimentara, legume_fructe sau magazin_nealimentar",
        },
      },
      required: ["business_type"],
      additionalProperties: false,
    },
    annotations: readOnly(false),
    async handler(args) {
      const type = String(args.business_type);
      const e = findChecklist(entries, type);
      if (!e) {
        const url = trackedUrl("/ghid", NAME);
        return {
          text: `Lista pentru acest tip de magazin nu este gata inca. Vezi ghidurile disponibile: ${url}`,
          structured: { business_type: type, found: false, url },
        };
      }
      const url = trackedUrl(e.page || pageFor(type), NAME);
      return {
        text: checklistMd(e, url),
        structured: {
          business_type: type,
          found: true,
          id: e.id,
          title: e.title,
          summary: e.summary,
          caen: e.caen ?? [],
          steps: (e.steps ?? []).map((s) => ({ title: s.title, authority: s.authority ?? null })),
          sources: checklistSources(e),
          verified_on: e.verified_on ?? null,
          url,
        },
      };
    },
  };
}
