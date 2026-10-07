import assert from "node:assert/strict";
import { test } from "node:test";
import { cashbookWorkbookXml } from "../src/lib/unelte/spreadsheet.ts";

test("cashbookWorkbookXml includes company and totals", () => {
  const xml = cashbookWorkbookXml({
    company: "Test SRL",
    date: "2026-03-01",
    opening_balance: 100,
    entries: [{ doc: "Z", description: "Vânzări", receipt: 50 }],
  });
  assert.match(xml, /Test SRL/);
  assert.match(xml, /Registru de casă/);
  assert.match(xml, /Excel\.Sheet/);
});
