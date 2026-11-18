// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAnalyticsEnabled,
  sanitizeCtaClickProperties,
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

test("sanitizeCtaClickProperties keeps utm_campaign with digit runs", () => {
  const out = sanitizeCtaClickProperties({
    location: "header",
    page_path: "/ghid/ordin-1802-2014/",
    target: "app-demo",
    target_url: "https://app.tapselo.com/",
    utm_campaign: "20261118",
    utm_source: "5941234000013-news",
  });
  assert.equal(out.utm_campaign, "20261118");
  assert.equal(out.utm_source, "5941234000013-news");
  assert.equal(out.page_path, "/ghid/ordin-1802-2014/");
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

test("isAnalyticsEnabled: E2E flag only on loopback", () => {
  const g = globalThis as { __TAPSELO_ANALYTICS_E2E__?: boolean };
  assert.equal(isAnalyticsEnabled("127.0.0.1", false), false);
  assert.equal(isAnalyticsEnabled("tapselo.com", true), false);
  try {
    g.__TAPSELO_ANALYTICS_E2E__ = true;
    assert.equal(isAnalyticsEnabled("127.0.0.1", false), true);
    assert.equal(isAnalyticsEnabled("localhost", false), true);
    assert.equal(isAnalyticsEnabled("tapselo.com", true), false, "E2E hook inert on non-loopback");
    const stagingBefore = isAnalyticsEnabled("preview.pages.dev", false);
    assert.equal(isAnalyticsEnabled("preview.pages.dev", false), stagingBefore, "E2E does not change non-loopback");
  } finally {
    delete g.__TAPSELO_ANALYTICS_E2E__;
  }
  assert.equal(isAnalyticsEnabled("127.0.0.1", false), false);
});

test("toolUsedProperties: descărcarea formularului gol trimite doar unealta, acțiunea și formatul", () => {
  assert.deepEqual(toolUsedProperties("dispozitie_de_plata", "download_blank", { format: "a5" }), {
    tool: "dispozitie_de_plata",
    action: "download_blank",
    format: "a5",
  });
});