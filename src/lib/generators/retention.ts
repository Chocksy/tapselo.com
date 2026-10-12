/** Days until MCP /g/ drafts expire (matches `public_tool_drafts.expires_at` in the pos DB). */
export const PUBLIC_TOOL_DRAFT_RETENTION_DAYS = 30;

/**
 * Earlier MCP copy and privacy drafts mentioned 90 days before the Oct 2026 directory review;
 * production DB default has been `interval '30 days'` since the first migration.
 */
export const PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS = 90;

export function retentionDaysLabel(days = PUBLIC_TOOL_DRAFT_RETENTION_DAYS): string {
  const r = days % 100;
  return days >= 20 && (r === 0 || r >= 20) ? `${days} de zile` : `${days} zile`;
}
