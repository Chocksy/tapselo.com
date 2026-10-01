// Stateless MCP (Streamable HTTP, JSON responses only) over JSON-RPC 2.0. Pure: no HTTP here.
// functions/mcp.ts handles methods, body size, CORS and headers, then calls handleMcp.

import type { ToolDef, ToolEnv, ToolResult } from "./types.ts";

export const SERVER_VERSION = "0.1.0";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
export const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

export const INSTRUCTIONS =
  "Tapselo ajuta magazinele mici din Romania: reguli fiscale si comerciale (TVA, casa de marcat, " +
  "plafoane, NIR, registrul de casa), erori Datecs, cantare Dibal si coduri de bare, calcul pret la raft, " +
  "verificare firma dupa CUI, liste de autorizatii pentru un magazin nou, comparatie programe POS, " +
  "cautare produse dupa EAN si documente printabile (flyer cu oferte, etichete de raft, NIR, fisa tehnica, " +
  "registru de casa).";

type Id = string | number | null;
interface RpcResponse {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpReply {
  status: number;
  json?: unknown;
}

export function rpcError(id: Id, code: number, message: string): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validId = (v: unknown): v is string | number => typeof v === "string" || (typeof v === "number" && Number.isFinite(v));

/** Handles one parsed JSON-RPC body (single message or batch). */
export async function handleMcp(body: unknown, tools: ToolDef[], env: ToolEnv): Promise<McpReply> {
  if (Array.isArray(body)) {
    if (body.length === 0) return { status: 200, json: rpcError(null, -32600, "Invalid Request") };
    const out = (await Promise.all(body.map((m) => handleMessage(m, tools, env)))).filter(
      (r): r is RpcResponse => r !== null,
    );
    return out.length ? { status: 200, json: out } : { status: 202 };
  }
  const res = await handleMessage(body, tools, env);
  return res ? { status: 200, json: res } : { status: 202 };
}

async function handleMessage(msg: unknown, tools: ToolDef[], env: ToolEnv): Promise<RpcResponse | null> {
  if (!isObj(msg) || msg.jsonrpc !== "2.0") return rpcError(null, -32600, "Invalid Request");
  const method = msg.method;
  const hasId = "id" in msg && msg.id !== undefined;

  // A response from the client (result/error, no method): nothing to answer.
  if (method === undefined && ("result" in msg || "error" in msg)) return null;
  if (typeof method !== "string") return rpcError(hasId && validId(msg.id) ? msg.id : null, -32600, "Invalid Request");
  // Notifications get no response.
  if (method.startsWith("notifications/") || !hasId) return null;
  if (!validId(msg.id)) return rpcError(null, -32600, "Invalid Request");
  const id = msg.id;
  const params = isObj(msg.params) ? msg.params : {};

  switch (method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion =
        typeof asked === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL_VERSION;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "tapselo", title: "Tapselo", version: SERVER_VERSION },
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            // The Claude directory reads the display name from annotations.title.
            annotations: { title: t.title, ...t.annotations },
          })),
        },
      };
    case "tools/call": {
      const name = params.name;
      const tool = typeof name === "string" ? tools.find((t) => t.name === name) : undefined;
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${typeof name === "string" ? name : "?"}`);
      const args = params.arguments === undefined || params.arguments === null ? {} : params.arguments;
      const result = await callTool(tool, args, env);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.structured ?? {},
          ...(result.isError ? { isError: true } : {}),
        },
      };
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const MSG_INTERNAL = "A aparut o eroare neasteptata. Incearca din nou peste putin timp.";

async function callTool(tool: ToolDef, args: unknown, env: ToolEnv): Promise<ToolResult> {
  const started = Date.now();
  let result: ToolResult;
  let kind = "ok";
  const problems = isObj(args) ? validate(args, tool.inputSchema, "") : ["argumentele trebuie sa fie un obiect"];
  if (problems.length) {
    kind = "invalid_args";
    result = {
      text: `Date de intrare invalide pentru ${tool.name}:\n${problems.slice(0, 8).map((p) => `- ${p}`).join("\n")}`,
      isError: true,
    };
  } else {
    try {
      result = await tool.handler(args as Record<string, unknown>, env);
      if (result.isError) kind = "tool_error";
    } catch (e) {
      kind = "exception";
      console.error(`mcp tool ${tool.name} threw`, e instanceof Error ? e.message : "");
      result = { text: MSG_INTERNAL, isError: true };
    }
  }
  // One line per call. No user text in logs.
  console.log(
    JSON.stringify({ evt: "mcp_tool", tool: tool.name, ok: !result.isError, ms: Date.now() - started, kind }),
  );
  return result;
}

// ---------------------------------------------------------------------------
// Minimal JSON Schema check for tool inputs (type, required, enum, bounds, items,
// additionalProperties: false). Unknown keywords are ignored. Messages in Romanian.
// ---------------------------------------------------------------------------

type Schema = Record<string, unknown>;

function typeOk(v: unknown, t: string): boolean {
  switch (t) {
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "boolean":
      return typeof v === "boolean";
    case "array":
      return Array.isArray(v);
    case "object":
      return isObj(v);
    case "null":
      return v === null;
    default:
      return true;
  }
}

const TYPE_RO: Record<string, string> = {
  string: "text",
  number: "numar",
  integer: "numar intreg",
  boolean: "true/false",
  array: "lista",
  object: "obiect",
  null: "null",
};

export function validate(v: unknown, schema: Schema, path: string): string[] {
  const at = path || "argumente";
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
  if (types.length && !types.some((t) => typeOk(v, t))) {
    return [`${at}: trebuie sa fie ${types.map((t) => TYPE_RO[t] ?? t).join(" sau ")}`];
  }
  const errs: string[] = [];
  if (Array.isArray(schema.enum) && !schema.enum.includes(v as never)) {
    errs.push(`${at}: valoare permisa doar una din ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  if (typeof v === "number") {
    if (typeof schema.minimum === "number" && v < schema.minimum) errs.push(`${at}: minim ${schema.minimum}`);
    if (typeof schema.maximum === "number" && v > schema.maximum) errs.push(`${at}: maxim ${schema.maximum}`);
    if (typeof schema.exclusiveMinimum === "number" && v <= schema.exclusiveMinimum)
      errs.push(`${at}: trebuie sa fie mai mare decat ${schema.exclusiveMinimum}`);
    if (typeof schema.exclusiveMaximum === "number" && v >= schema.exclusiveMaximum)
      errs.push(`${at}: trebuie sa fie mai mic decat ${schema.exclusiveMaximum}`);
  }
  if (typeof v === "string") {
    if (typeof schema.minLength === "number" && v.length < schema.minLength) errs.push(`${at}: prea scurt`);
    if (typeof schema.maxLength === "number" && v.length > schema.maxLength)
      errs.push(`${at}: maxim ${schema.maxLength} caractere`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(v)) errs.push(`${at}: format invalid`);
  }
  if (Array.isArray(v)) {
    if (typeof schema.minItems === "number" && v.length < schema.minItems) errs.push(`${at}: minim ${schema.minItems} elemente`);
    if (typeof schema.maxItems === "number" && v.length > schema.maxItems) errs.push(`${at}: maxim ${schema.maxItems} elemente`);
    if (isObj(schema.items)) v.forEach((item, i) => errs.push(...validate(item, schema.items as Schema, `${at}[${i}]`)));
  }
  if (isObj(v)) {
    const props = isObj(schema.properties) ? (schema.properties as Record<string, Schema>) : {};
    for (const r of Array.isArray(schema.required) ? (schema.required as string[]) : []) {
      if (v[r] === undefined) errs.push(`${path ? `${path}.` : ""}${r}: lipseste`);
    }
    for (const [k, val] of Object.entries(v)) {
      const p = path ? `${path}.${k}` : k;
      if (props[k]) {
        if (val !== undefined) errs.push(...validate(val, props[k], p));
      } else if (schema.additionalProperties === false) {
        errs.push(`${p}: camp necunoscut`);
      }
    }
  }
  return errs;
}
