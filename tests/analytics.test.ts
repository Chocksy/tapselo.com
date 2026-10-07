// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAnalyticsEnabled,
  sanitizeEventProperties,
  toolUsedProperties,
} from "../src/lib/analytics.ts";

test("sanitizeEventProperties drops EAN-like strings and sensitive keys", () => {
  const ean = "5941234000013";
  const out = sanitizeEventProperties({
    tool: "verificare_cod_de_bare",
    ean,
    barcode: ean,
    note: `lookup ${ean}`,
    found_tapselo: true,
    cui: "12345678",
  });
  assert.equal(out.tool, "verificare_cod_de_bare");
  assert.equal(out.found_tapselo, true);
  assert.equal("ean" in out, false);
  assert.equal("barcode" in out, false);
  assert.equal("note" in out, false);
  assert.equal("cui" in out, false);
  assert.ok(!JSON.stringify(out).includes(ean));
});

test("toolUsedProperties never includes raw EAN in extras", () => {
  const props = toolUsedProperties("calculator_tva", "lookup", { scanned: "2800123012345" });
  assert.equal(props.tool, "calculator_tva");
  assert.equal(props.action, "lookup");
  assert.equal("scanned" in props, false);
});

test("isAnalyticsEnabled is false on localhost and in Astro dev", () => {
  assert.equal(isAnalyticsEnabled("localhost", false), false);
  assert.equal(isAnalyticsEnabled("tapselo.com", true), false);
  assert.equal(isAnalyticsEnabled("tapselo.com", false), true);
});
