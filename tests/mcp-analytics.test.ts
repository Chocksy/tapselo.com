// Run: npm test. Usage events: right tool, ok flag, client name, no user text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mcpEvents } from "../src/lib/mcp/analytics.ts";

test("mcpEvents: initialize and tools/call, ok from the matching reply", () => {
  const body = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "claude-ai", version: "1.0" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_company", arguments: { cui: "secret" } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_business_rules", arguments: { query: "tva" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
  const reply = [
    { jsonrpc: "2.0", id: 1, result: {} },
    { jsonrpc: "2.0", id: 2, result: { content: [], isError: true } },
    { jsonrpc: "2.0", id: 3, result: { content: [] } },
  ];
  const ev = mcpEvents(body, reply, "openai-mcp/1.0");
  assert.deepEqual(ev, [
    { event: "mcp_initialize", properties: { client: "claude-ai", client_version: "1.0", ua: "openai-mcp/1.0" } },
    { event: "mcp_tool_call", properties: { tool: "check_company", ok: false, ua: "openai-mcp/1.0" } },
    { event: "mcp_tool_call", properties: { tool: "search_business_rules", ok: true, ua: "openai-mcp/1.0" } },
  ]);
  assert.ok(!JSON.stringify(ev).includes("secret"));
});
