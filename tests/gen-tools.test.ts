import { test } from "node:test";
import assert from "node:assert/strict";
import { generatorTools, MSG_SERVICE } from "../src/lib/generators/tools.ts";
import { MOCK_DRAFTS } from "../src/lib/generators/mock.ts";
import type { ToolEnv } from "../src/lib/mcp/types.ts";

type Call = { fn: string; args: Record<string, unknown> };

function stubEnv(result: { ok: true; data: unknown } | { ok: false; kind: string; message: string }) {
  const calls: Call[] = [];
  const env: ToolEnv = {
    rpc: (async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    }) as ToolEnv["rpc"],
    fetch: (async () => {
      throw new Error("no fetch in generator tools");
    }) as typeof fetch,
  };
  return { env, calls };
}

const tool = (name: string) => {
  const t = generatorTools.find((x) => x.name === name);
  assert.ok(t, name);
  return t;
};

const BY_KIND = {
  flyer: "create_offer_flyer",
  labels: "create_shelf_labels",
  nir: "create_nir",
  recipe: "create_recipe_sheet",
  cashbook: "create_cash_book",
} as const;

test("registry: five tools with schemas and annotations", () => {
  assert.deepEqual(generatorTools.map((t) => t.name), Object.values(BY_KIND));
  for (const t of generatorTools) {
    assert.equal(t.inputSchema.type, "object");
    assert.deepEqual(t.annotations, { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true });
    assert.ok(t.title && t.description);
  }
});

test("each tool: validates, calls the RPC, answers with a tracked tapselo.com/g/ link", async () => {
  for (const [kind, name] of Object.entries(BY_KIND)) {
    const { env, calls } = stubEnv({ ok: true, data: "Ab3dEf7hJk" });
    const r = await tool(name).handler(structuredClone(MOCK_DRAFTS[kind as keyof typeof BY_KIND].payload) as Record<string, unknown>, env);
    assert.equal(r.isError, undefined, `${name}: ${r.text}`);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fn, "public_tool_create_draft");
    assert.equal(calls[0].args.p_kind, kind);
    const url = `https://tapselo.com/g/Ab3dEf7hJk?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=${name}`;
    assert.ok(r.text.includes(url), r.text);
    assert.equal(r.structured?.url, url);
    assert.equal(r.structured?.id, "Ab3dEf7hJk");
    assert.equal(r.structured?.kind, kind);
  }
});

test("NIR answer carries the totals", async () => {
  const { env } = stubEnv({ ok: true, data: "Ab3dEf7hJk" });
  const r = await tool("create_nir").handler(structuredClone(MOCK_DRAFTS.nir.payload) as Record<string, unknown>, env);
  assert.match(r.text, /Valoare achizitie fara TVA 482,20 lei, TVA 57,31 lei, total 539,51 lei\./);
  assert.equal(r.structured?.cost_total, 539.51);
  assert.equal(r.structured?.sale_value, 687.83);
});

test("labels answer names invalid EANs and missing unit prices", async () => {
  const { env } = stubEnv({ ok: true, data: "Ab3dEf7hJk" });
  const r = await tool("create_shelf_labels").handler(structuredClone(MOCK_DRAFTS.labels.payload) as Record<string, unknown>, env);
  assert.match(r.text, /Cod EAN invalid .*: Ulei Floriol 1L\./);
  assert.match(r.text, /Fara pret unitar .*: Biscuiti cu unt\./);
  assert.equal(r.structured?.invalid_ean, 1);
});

test("the payload sent to the RPC is the cleaned one", async () => {
  const { env, calls } = stubEnv({ ok: true, data: "Ab3dEf7hJk" });
  await tool("create_shelf_labels").handler({ products: [{ name: "  Paine\u0007 ", price: "4,5", unit: "buc", extra: "x" }] }, env);
  assert.deepEqual(calls[0].args.p_payload, { products: [{ name: "Paine", price: 4.5, unit: "buc" }] });
});

test("bad input: isError in Romanian, no RPC call", async () => {
  const { env, calls } = stubEnv({ ok: true, data: "Ab3dEf7hJk" });
  const r = await tool("create_offer_flyer").handler({ store_name: "Magazin", products: [{ name: "Vezi https://x.ro", price: 5, unit: "buc" }] }, env);
  assert.equal(r.isError, true);
  assert.match(r.text, /^Datele nu sunt bune: Campul "products\[0\]\.name" contine o adresa web/);
  assert.equal(calls.length, 0);
});

test("RPC failures map to friendly errors", async () => {
  let r = await tool("create_cash_book").handler(structuredClone(MOCK_DRAFTS.cashbook.payload) as Record<string, unknown>, stubEnv({ ok: false, kind: "rejected", message: "Prea multe documente in ultima ora. Incearca mai tarziu." }).env);
  assert.equal(r.isError, true);
  assert.equal(r.text, "Nu am putut crea documentul: Prea multe documente in ultima ora. Incearca mai tarziu.");

  for (const kind of ["network", "missing"]) {
    r = await tool("create_cash_book").handler(structuredClone(MOCK_DRAFTS.cashbook.payload) as Record<string, unknown>, stubEnv({ ok: false, kind, message: "x" }).env);
    assert.equal(r.isError, true);
    assert.equal(r.text, MSG_SERVICE);
  }
  for (const data of [null, "", "bad id!", 42, { id: "Ab3dEf7hJk" }]) {
    r = await tool("create_cash_book").handler(structuredClone(MOCK_DRAFTS.cashbook.payload) as Record<string, unknown>, stubEnv({ ok: true, data }).env);
    assert.equal(r.isError, true, String(data));
  }
});
