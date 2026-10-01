/**
 * /mcp: public MCP server for Claude and ChatGPT (stateless Streamable HTTP, JSON responses).
 *
 * POST: JSON-RPC body (single or batch), max 256 KB -> src/lib/mcp/server.ts.
 * OPTIONS: 204 with permissive CORS (MCP Inspector). GET / DELETE / others: 405 (no SSE stream, no sessions).
 * No auth: every tool is public; abuse caps live in SQL (see the pos migration for public_tool_*).
 */

import { rpc } from "../src/lib/supabase-public.ts";
import { handleMcp, rpcError } from "../src/lib/mcp/server.ts";
import { allTools } from "../src/lib/mcp/tools.ts";
import type { ToolEnv } from "../src/lib/mcp/types.ts";
import { mcpEvents, sendEvents } from "../src/lib/mcp/analytics.ts";

const MAX_BODY = 256 * 1024;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const BASE_HEADERS: Record<string, string> = {
  ...CORS,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
  });
}

const env: ToolEnv = {
  rpc: (fn, args) => rpc(fn, args),
  // Workers need fetch called unbound from the global.
  fetch: (input, init) => fetch(input, init),
};

export async function onRequest(context: { request: Request; waitUntil: (p: Promise<unknown>) => void }) {
  const { request } = context;
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...BASE_HEADERS, Allow: "POST, OPTIONS" } });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return json(rpcError(null, -32700, "Parse error"));
  }

  const reply = await handleMcp(body, allTools, env);
  context.waitUntil(sendEvents(mcpEvents(body, reply.json, request.headers.get("user-agent"))));
  if (reply.json === undefined) return new Response(null, { status: reply.status, headers: BASE_HEADERS });
  return json(reply.json, reply.status);
}
