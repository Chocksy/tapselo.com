// Anonymous usage events for the AI plugin, sent to PostHog (EU project 116119).
// No user text, no IP, no person profiles: only which client, which tool, ok or not.

import { DEFAULT_POSTHOG_KEY } from "../analytics.ts";

const POSTHOG_URL = "https://eu.i.posthog.com/batch/";
const POSTHOG_KEY = DEFAULT_POSTHOG_KEY;

export interface McpEvent {
  event: string;
  properties: Record<string, string | boolean | number | null>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const short = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : null);

/** Events for one /mcp request: one per initialize and one per tools/call. */
export function mcpEvents(body: unknown, reply: unknown, userAgent: string | null): McpEvent[] {
  const msgs = (Array.isArray(body) ? body : [body]).filter(isObj);
  const replies = (Array.isArray(reply) ? reply : [reply]).filter(isObj);
  const ua = short(userAgent);
  const out: McpEvent[] = [];
  for (const m of msgs) {
    const params = isObj(m.params) ? m.params : {};
    if (m.method === "initialize") {
      const info = isObj(params.clientInfo) ? params.clientInfo : {};
      out.push({ event: "mcp_initialize", properties: { client: short(info.name), client_version: short(info.version), ua } });
    } else if (m.method === "tools/call") {
      const r = replies.find((x) => x.id === m.id);
      const result = r && isObj(r.result) ? r.result : null;
      const ok = !!result && result.isError !== true;
      out.push({ event: "mcp_tool_call", properties: { tool: short(params.name), ok, ua } });
    }
  }
  return out;
}

/** Fire-and-forget send; failures are only logged. */
export async function sendEvents(events: McpEvent[], fetchFn: typeof fetch = fetch): Promise<void> {
  if (!events.length) return;
  const now = new Date().toISOString();
  const batch = events.map((e) => ({
    event: e.event,
    distinct_id: "tapselo-mcp",
    timestamp: now,
    properties: { ...e.properties, $process_person_profile: false, $ip: null, $lib: "tapselo-mcp" },
  }));
  try {
    const res = await fetchFn(POSTHOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
    });
    if (!res.ok) console.error("posthog batch failed", res.status);
  } catch (e) {
    console.error("posthog batch threw", e instanceof Error ? e.message : "");
  }
}
