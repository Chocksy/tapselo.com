import assert from "node:assert/strict";
import { test } from "node:test";
import { formatScheduleLines, shopHeaderLines } from "../src/lib/unelte/afise-obligatorii/schedule.ts";
import { buildSigns, CASA_MARCAT_MAIN, defaultToolState } from "../src/lib/unelte/afise-obligatorii/signs.ts";
import { renderSignsPrintHtml } from "../src/lib/unelte/afise-obligatorii/render.ts";

test("formatScheduleLines: closed days and break", () => {
  const s = defaultToolState().schedule;
  s.sun = null;
  s.breakLabel = "13:00–14:00";
  const lines = formatScheduleLines(s);
  assert.ok(lines.some((l) => l.includes("Duminică: închis")));
  assert.ok(lines.some((l) => l.includes("Pauză: 13:00–14:00")));
});

test("shopHeaderLines reuses business fields across signs", () => {
  const shop = { businessName: "Magazin Test SRL", address: "Str. Exemplu 1", cui: "RO123" };
  const header = shopHeaderLines(shop);
  assert.deepEqual(header, ["Magazin Test SRL", "Str. Exemplu 1", "CUI: RO123"]);
  const state = defaultToolState();
  state.shop = { ...shop, logoDataUrl: null };
  state.selected = ["program"];
  const sign = buildSigns(state)[0];
  assert.match(sign.bodyHtml, /Magazin Test SRL/);
  assert.match(sign.bodyHtml, /Str\. Exemplu 1/);
});

test("casa de marcat sign keeps official diacritics", () => {
  assert.match(CASA_MARCAT_MAIN, /ț/);
  assert.match(CASA_MARCAT_MAIN, /ă/);
  const state = defaultToolState();
  state.selected = ["casa_marcat"];
  const html = renderSignsPrintHtml(buildSigns(state), state.shop);
  assert.match(html, /dotată/);
  assert.match(html, /solicitați/);
  assert.match(html, /Noto Sans|SignRo/);
});
