import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allTools } from "../src/lib/mcp/tools.ts";
import { generatorTools } from "../src/lib/generators/tools.ts";
import {
  PUBLIC_TOOL_DRAFT_RETENTION_DAYS,
  PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS,
  PUBLIC_TOOL_SENSITIVE_RETENTION_DAYS,
  retentionDaysForKind,
} from "../src/lib/generators/retention.ts";
import { PUBLIC_TOOL_ID_ENTROPY_BITS, PUBLIC_TOOL_ID_LENGTH } from "../src/lib/generators/id.ts";
import { PUBLIC_PAGE_NOTICE } from "../src/lib/generators/page.ts";
import { parseCreateDraftRpc } from "../src/lib/generators/draft-rpc.ts";
import { deletePublicDraft } from "../src/lib/generators/delete-draft.ts";

const GENERATOR_NAMES = [
  "create_offer_flyer",
  "create_shelf_labels",
  "create_nir",
  "create_recipe_sheet",
  "create_cash_book",
] as const;

const FORBIDDEN = [
  /always include.*tapselo/i,
  /include a tapselo link/i,
  /include the tapselo link/i,
  /include.*link.*in (every|each) (answer|response)/i,
  /cu poze generate/i,
];

test("/g/ Cloudflare function sets X-Robots-Tag noindex on HTML responses", () => {
  const src = readFileSync(new URL("../functions/g/[id].ts", import.meta.url), "utf8");
  assert.match(src, /"X-Robots-Tag": "noindex, nofollow"/);
  assert.match(src, /method === "DELETE"/);
});

test("document id entropy (~59.5 bits for 10 base62 chars)", () => {
  assert.equal(PUBLIC_TOOL_ID_LENGTH, 10);
  assert.ok(PUBLIC_TOOL_ID_ENTROPY_BITS > 59 && PUBLIC_TOOL_ID_ENTROPY_BITS < 60);
});

test("retention per kind: 7 days NIR/cash book, 30 days others", () => {
  assert.equal(PUBLIC_TOOL_DRAFT_RETENTION_DAYS, 30);
  assert.equal(PUBLIC_TOOL_SENSITIVE_RETENTION_DAYS, 7);
  assert.equal(PUBLIC_TOOL_DRAFT_RETENTION_DAYS_PREVIOUS, 90);
  assert.equal(retentionDaysForKind("nir"), 7);
  assert.equal(retentionDaysForKind("cashbook"), 7);
  assert.equal(retentionDaysForKind("flyer"), 30);
});

test("generator tool descriptions start with the public-page notice", () => {
  for (const name of GENERATOR_NAMES) {
    const t = generatorTools.find((x) => x.name === name);
    assert.ok(t, name);
    assert.ok(t.description.startsWith(PUBLIC_PAGE_NOTICE), name);
  }
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

test("create_offer_flyer documents emoji-only image source in the tool description", () => {
  const flyer = generatorTools.find((t) => t.name === "create_offer_flyer");
  assert.ok(flyer);
  assert.match(flyer.description, /emojiFor/);
  assert.match(flyer.description, /image_url: null/);
  assert.match(flyer.description, /no generative model/i);
});
