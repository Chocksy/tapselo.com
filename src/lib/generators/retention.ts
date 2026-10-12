import type { DraftKind } from "./types.ts";

/** Default retention for low-sensitivity printable documents (flyer, labels, recipe). */
export const PUBLIC_TOOL_DRAFT_RETENTION_DAYS = 30;

/**
 * NIR and cash book often include supplier names, amounts and daily cash positions;
 * shorter public exposure reduces risk if the link is shared by mistake.
 */
export const PUBLIC_TOOL_SENSITIVE_RETENTION_DAYS = 7;

/**
 * Earlier MCP copy mentioned 90 days before the Oct 2026 directory review;
 * production DB default was `interval '30 days'` for all kinds until per-kind TTL.
 */
export const PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS = 90;

const RETENTION_BY_KIND: Record<DraftKind, number> = {
  flyer: PUBLIC_TOOL_DRAFT_RETENTION_DAYS,
  labels: PUBLIC_TOOL_DRAFT_RETENTION_DAYS,
  recipe: PUBLIC_TOOL_DRAFT_RETENTION_DAYS,
  nir: PUBLIC_TOOL_SENSITIVE_RETENTION_DAYS,
  cashbook: PUBLIC_TOOL_SENSITIVE_RETENTION_DAYS,
};

export function retentionDaysForKind(kind: DraftKind): number {
  return RETENTION_BY_KIND[kind];
}

export function retentionDaysLabel(days: number): string {
  const r = days % 100;
  if (days < 24 && days === 1) return "1 zi";
  if (days < 24) return `${days} zile`;
  return days >= 20 && (r === 0 || r >= 20) ? `${days} de zile` : `${days} zile`;
}

export function retentionHoursLabel(hours: number): string {
  return hours === 1 ? "1 oră" : `${hours} ore`;
}

/** Human-readable expiry for tool answers (7d kinds vs 30d). */
export function retentionLabelForKind(kind: DraftKind): string {
  const days = retentionDaysForKind(kind);
  return retentionDaysLabel(days);
}
