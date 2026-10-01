// Run: npm test (node --test, native TypeScript type stripping, no dependencies).
// JSON-RPC handling of /mcp, called directly through handleMcp with inline fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp, validate, INSTRUCTIONS } from "../src/lib/mcp/server.ts";
import { createAnswerTools, ANSWER_TOOL_NAMES } from "../src/lib/mcp/answers/index.ts";
import type { ToolDef, ToolEnv } from "../src/lib/mcp/types.ts";
import datecs from "../src/lib/kb/datecs-errors.json" with { type: "json" };
import dibal from "../src/lib/kb/dibal.json" with { type: "json" };

const rule = {
  id: "tva-paine",
  title: "Cota TVA pentru paine",
  summary: "Painea are cota redusa de TVA de 11%.",
  body: "Pe casa de marcat pune painea pe grupa cu 11%.",
  keywords: ["tva paine", "grupa tva", "cota redusa"],
  sources: [{ title: "Codul fiscal", url: "https://legislatie.just.ro/" }],
  verified_on: "2026-09-30",
  page: "/ghid/tva-casa-de-marcat",
};

const tools = createAnswerTools({ rules: [rule], checklists: [], competitors: [], datecs, dibal });

const env: ToolEnv = {
  rpc: async () => ({ ok: false, kind: "missing", message: "no rpc in tests" }),
  fetch: async () => {
    throw new Error("no network in tests");
  },
};

const call = (body: unknown, t: ToolDef[] = tools) => handleMcp(body, t, env);
type Res = { jsonrpc: string; id: unknown; result?: any; error?: { code: number; message: string } };

test("initialize echoes a supported protocol version, else 2025-06-18", async () => {
  const r = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {} } });
  assert.equal(r.status, 200);
  const res = r.json as Res;
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, "2025-03-26");
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.serverInfo.name, "tapselo");
  assert.equal(res.result.serverInfo.title, "Tapselo pentru magazine");
  assert.equal(typeof res.result.serverInfo.version, "string");
  assert.equal(res.result.instructions, INSTRUCTIONS);

  const r2 = await call({ jsonrpc: "2.0", id: "a", method: "initialize", params: { protocolVersion: "2099-01-01" } });
  assert.equal((r2.json as Res).result.protocolVersion, "2025-06-18");
  for (const v of ["2025-11-25", "2025-06-18"]) {
    const r3 = await call({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: v } });
    assert.equal((r3.json as Res).result.protocolVersion, v);
  }
});

test("notifications get 202 with no body", async () => {
  const r = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.deepEqual(r, { status: 202 });
  const r2 = await call({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } });
  assert.deepEqual(r2, { status: 202 });
  // A batch of only notifications.
  assert.deepEqual(await call([{ jsonrpc: "2.0", method: "notifications/initialized" }]), { status: 202 });
});

test("ping, unknown method, invalid requests", async () => {
  assert.deepEqual((await call({ jsonrpc: "2.0", id: 7, method: "ping" })).json, { jsonrpc: "2.0", id: 7, result: {} });
  const unknown = (await call({ jsonrpc: "2.0", id: 8, method: "resources/list" })).json as Res;
  assert.equal(unknown.error?.code, -32601);
  assert.equal(((await call({ id: 1, method: "ping" })).json as Res).error?.code, -32600);
  assert.equal(((await call("hello")).json as Res).error?.code, -32600);
  assert.equal(((await call([])).json as Res).error?.code, -32600);
  assert.equal(((await call({ jsonrpc: "2.0", id: 9 })).json as Res).error?.code, -32600);
});

test("batch: answers requests in order, skips notifications", async () => {
  const r = await call([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  assert.equal(r.status, 200);
  const out = r.json as Res[];
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.id), [1, 2]);
});

test("tools/list contains every answer tool with schema and annotations", async () => {
  const res = (await call({ jsonrpc: "2.0", id: 3, method: "tools/list" })).json as Res;
  const listed = res.result.tools as { name: string; title: string; description: string; inputSchema: any; annotations: any }[];
  const names = listed.map((t) => t.name);
  for (const n of ANSWER_TOOL_NAMES) assert.ok(names.includes(n), `missing ${n}`);
  for (const t of listed) {
    assert.equal(t.inputSchema.type, "object", t.name);
    assert.equal(t.inputSchema.additionalProperties, false, t.name);
    assert.ok(t.title && t.description.length > 80, t.name);
    assert.equal(t.annotations.readOnlyHint, true, t.name);
    assert.equal(t.annotations.destructiveHint, false, t.name);
    assert.equal(t.annotations.idempotentHint, true, t.name);
    assert.equal(typeof t.annotations.openWorldHint, "boolean", t.name);
    assert.equal("handler" in t, false);
  }
  const ow = Object.fromEntries(listed.map((t) => [t.name, t.annotations.openWorldHint]));
  assert.equal(ow.check_company, true);
  assert.equal(ow.check_tax_thresholds, true);
  assert.equal(ow.lookup_products_by_ean, true);
  assert.equal(ow.calculate_shelf_price, false);
});

test("tools/call calculate_shelf_price: 10 lei, adaos 30%, TVA 11%, rotunjire ,49/,99 -> 14,49 lei", async () => {
  const res = (
    await call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "calculate_shelf_price",
        arguments: { cost: 10, markup_percent: 30, vat_rate: 11, rounding: "0.49_0.99" },
      },
    })
  ).json as Res;
  const r = res.result;
  assert.equal(r.isError, undefined);
  assert.equal(r.content[0].type, "text");
  assert.match(r.content[0].text, /Pret la raft: 14,49 lei/);
  assert.match(r.content[0].text, /inainte de rotunjire: 14,43 lei/);
  assert.match(r.content[0].text, /utm_source=ai-plugin&utm_medium=mcp&utm_campaign=calculate_shelf_price/);
  assert.equal(r.structuredContent.price_before_rounding, 14.43);
  assert.equal(r.structuredContent.price_with_vat, 14.49);
  assert.equal(r.structuredContent.price_with_vat_text, "14,49 lei");
});

test("tools/call: bad arguments give isError in Romanian, unknown tool is -32602", async () => {
  const bad = (
    await call({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "calculate_shelf_price", arguments: { cost: "zece", vat_rate: 19, extra: 1 } },
    })
  ).json as Res;
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /cost: trebuie sa fie numar/);
  assert.match(bad.result.content[0].text, /vat_rate: valoare permisa doar una din 21, 11, 0/);
  assert.match(bad.result.content[0].text, /extra: camp necunoscut/);

  const missing = (await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "check_company" } })).json as Res;
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /cui: lipseste/);

  const unknown = (await call({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "nope", arguments: {} } })).json as Res;
  assert.equal(unknown.error?.code, -32602);
});

test("a throwing handler becomes isError, and one log line without user text", async () => {
  const boom: ToolDef = {
    name: "boom",
    title: "x",
    description: "x",
    inputSchema: { type: "object", properties: { q: { type: "string" } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: async () => {
      throw new Error("secret");
    },
  };
  const logs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => logs.push(a.join(" "));
  console.error = () => {};
  try {
    const res = (await call({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "boom", arguments: { q: "user text 123" } } }, [boom]))
      .json as Res;
    assert.equal(res.result.isError, true);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assert.equal(logs.length, 1);
  const line = JSON.parse(logs[0]);
  assert.equal(line.tool, "boom");
  assert.equal(line.ok, false);
  assert.equal(line.kind, "exception");
  assert.equal(typeof line.ms, "number");
  assert.ok(!logs[0].includes("user text"));
});

test("validate: nested arrays and objects", () => {
  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        maxItems: 2,
        items: { type: "object", properties: { n: { type: "integer", minimum: 1 } }, required: ["n"], additionalProperties: false },
      },
    },
    required: ["items"],
  };
  assert.deepEqual(validate({ items: [{ n: 1 }] }, schema, ""), []);
  const errs = validate({ items: [{ n: 0 }, { x: 1 }, { n: 2 }] }, schema, "");
  assert.ok(errs.includes("items: maxim 2 elemente"));
  assert.ok(errs.includes("items[0].n: minim 1"));
  assert.ok(errs.includes("items[1].n: lipseste"));
  assert.ok(errs.includes("items[1].x: camp necunoscut"));
});
