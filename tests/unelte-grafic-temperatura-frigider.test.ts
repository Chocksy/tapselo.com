import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { renderFridgeTempLog } from "../src/lib/generators/fridge-temp-log.ts";
import {
  ANNEX_II_2D_TEMPERATURE_CLAUSE,
  CLEANING_TAB_NOTICE,
  TEMP_LEGAL_NOTICE,
} from "../src/lib/unelte/grafic-temperatura-frigider.ts";
import type { FridgeTempLogPayload } from "../src/lib/unelte/fridge-temp-types.ts";

const SAMPLE: FridgeTempLogPayload = {
  company: "Magazin Test SRL",
  company_tax_id: "RO111",
  location: "Str. Exemplu 1",
  month: 11,
  year: 2026,
  appliances: [
    { name: "Frigider lactate", kind: "frigider", temp_min: 2, temp_max: 6, days: [{ morning_temp: "4", morning_initials: "AB" }] },
  ],
  days: [],
  responsible_name: "Ion Pop",
  responsible_role: "Administrator",
};

const CEDILLA = /[şţŞŢ]/;
const FORBIDDEN_PAGE =
  /\b(0–4\s*°C obligatoriu|0-4\s*°C obligatoriu|−18\s*°C obligatoriu|ANSVSA aprobat|obligatoriu zilnic|păstrați 1 an|păstrați 2 ani)\b/i;

test("frigider HTML: lună, aparat, fără XSS", () => {
  const html = renderFridgeTempLog(SAMPLE, { kind: "local", payload: null, expires_at: null });
  assert.match(html, /Grafic de temperatură frigider și congelator/);
  assert.match(html, /Magazin Test SRL/);
  assert.match(html, /Frigider lactate/);
  assert.match(html, /min 2 °C/);
  assert.doesNotMatch(html, CEDILLA);
});

test("pagina frigider: notice, title, tabs, FAQ", () => {
  const html = readFileSync(join(process.cwd(), "dist/unelte/grafic-temperatura-frigider/index.html"), "utf8");
  const noticeIdx = html.indexOf("gtf-legal-notice");
  const toolIdx = html.indexOf("gtf-panel-temp");
  assert.ok(noticeIdx > 0 && noticeIdx < toolIdx);
  assert.ok(html.includes(TEMP_LEGAL_NOTICE));
  assert.ok(html.includes(CLEANING_TAB_NOTICE));
  assert.match(html, new RegExp(ANNEX_II_2D_TEMPERATURE_CLAUSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(
    html,
    /<title>Grafic temperatură frigider — model lunar A4 gratuit \(PDF\) \| Tapselo<\/title>/,
  );
  assert.match(html, /<h1[^>]*>Grafic de temperatură frigider și congelator \(model lunar\)<\/h1>/);
  assert.ok(html.includes("gtf-tab-temp") && html.includes("gtf-tab-clean"));
  assert.match(html, /dacă este nevoie/);
  assert.match(html, /Verificat la 10\.11\.2026/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  assert.ok(blocks.some((b) => b["@type"] === "FAQPage"));
  assert.ok(blocks.some((b) => b["@type"] === "WebApplication"));
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /dezinfectarea incintelor sunt cerute/i);
  assert.doesNotMatch(text, /monitorizarea temperaturilor adecvate/i);
  const faqPage = blocks.find((b) => b["@type"] === "FAQPage");
  assert.ok(faqPage);
  const faqText = JSON.stringify(faqPage.mainEntity);
  assert.ok(faqText.includes(ANNEX_II_2D_TEMPERATURE_CLAUSE));
  assert.ok(faqText.includes(CLEANING_TAB_NOTICE));
  assert.doesNotMatch(faqText, /dezinfectarea incintelor sunt cerute/i);
  assert.doesNotMatch(text, FORBIDDEN_PAGE);
  assert.doesNotMatch(text, CEDILLA);
});

test("frigider: hub și sitemap", () => {
  const hub = readFileSync(join(process.cwd(), "dist/unelte/index.html"), "utf8");
  assert.match(hub, /href="\/unelte\/grafic-temperatura-frigider\/"/);
  const sitemap = readFileSync(join(process.cwd(), "dist/sitemap-0.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/tapselo\.com\/unelte\/grafic-temperatura-frigider\/<\/loc>\s*<lastmod>2026-11-11/,
  );
});
