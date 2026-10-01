// Shared markdown rendering for knowledge base answers (rules, Dibal, checklists).

import type { KbEntry } from "../text.ts";
import { formatDateRo } from "../text.ts";
import { trackedUrl } from "../links.ts";

/** Annotations for answer tools: read-only; openWorld when the tool calls an outside API. */
export function readOnly(openWorldHint: boolean) {
  return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint };
}

export function sourcesMd(sources: KbEntry["sources"] | undefined): string {
  const list = (sources ?? []).filter((s) => s && typeof s.url === "string");
  if (!list.length) return "";
  return "Surse:\n" + list.map((s) => `- [${s.title || s.url}](${s.url})`).join("\n");
}

/** One entry as markdown: title, summary, body, sources, verified date, tracked link. */
export function entryMd(e: KbEntry, campaign: string, fallbackPage = "/ghid"): string {
  const url = trackedUrl(e.page || fallbackPage, campaign);
  return [
    `### ${e.title}`,
    e.summary,
    e.body,
    sourcesMd(e.sources),
    e.verified_on ? `Verificat la ${formatDateRo(e.verified_on)}.` : "",
    `Detalii: ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Structured copy of an entry for structuredContent (no body duplication beyond what is useful). */
export function entryData(e: KbEntry, campaign: string, fallbackPage = "/ghid") {
  return {
    id: e.id,
    title: e.title,
    summary: e.summary,
    sources: e.sources ?? [],
    verified_on: e.verified_on ?? null,
    url: trackedUrl(e.page || fallbackPage, campaign),
  };
}
