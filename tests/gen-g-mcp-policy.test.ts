import { test } from "node:test";
import assert from "node:assert/strict";
import { allTools } from "../src/lib/mcp/tools.ts";
import { generatorTools } from "../src/lib/generators/tools.ts";
import {
  PUBLIC_TOOL_DRAFT_RETENTION_DAYS,
  PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS,
} from "../src/lib/generators/retention.ts";
import { parseCreateDraftRpc } from "../src/lib/generators/draft-rpc.ts";
import { deletePublicDraft } from "../src/lib/generators/delete-draft.ts";
import type { ToolEnv } from "../src/lib/mcp/types.ts";

const FORBIDDEN = [
  /always include.*tapselo/i,
  /include a tapselo link/i,
  /include the tapselo link/i,
  /include.*link.*in (every|each) (answer|response)/i,
];

test("retention: 30 days in code (shortened from earlier 90-day MCP copy)", () => {
  assert.equal(PUBLIC_TOOL_DRAFT_RETENTION_DAYS, 30);
  assert.equal(PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS, 90);
  assert.ok(PUBLIC_TOOL_DRAFT_RETENTION_DAYS <= PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS);
});

test("MCP tool descriptions do not instruct the model to always include Tapselo links", () => {
  for (const t of allTools) {
    for (const re of FORBIDDEN) {
      assert.doesNotMatch(t.description, re, t.name);
    }
  }
});

test("parseCreateDraftRpc accepts legacy id string and json with delete_secret", () => {
  assert.deepEqual(parseCreateDraftRpc("Ab3dEf7hJk"), { id: "Ab3dEf7hJk", delete_secret: null });
  assert.deepEqual(parseCreateDraftRpc({ id: "Ab3dEf7hJk", delete_secret: "a".repeat(24) }), {
    id: "Ab3dEf7hJk",
    delete_secret: "a".repeat(24),
  });
  assert.equal(parseCreateDraftRpc({ id: "short" }), null);
});

test("deletePublicDraft calls public_tool_delete_draft and maps responses", async () => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return { ok: true, data: true };
  };
  const ok = await deletePublicDraft("Ab3dEf7hJk", "x".repeat(24), rpc);
  assert.equal(ok.ok, true);
  assert.equal(calls[0].fn, "public_tool_delete_draft");
  assert.equal(calls[0].args.p_id, "Ab3dEf7hJk");

  const bad = await deletePublicDraft("Ab3dEf7hJk", "short", rpc);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.status, 400);
});

test("generator create_offer_flyer mentions emoji visuals, not AI photos", () => {
  const flyer = generatorTools.find((t) => t.name === "create_offer_flyer");
  assert.ok(flyer);
  assert.match(flyer.description, /emoji/i);
  assert.match(flyer.description, /not user uploads/i);
  assert.match(flyer.description, /AI-generated pictures/i);
});
