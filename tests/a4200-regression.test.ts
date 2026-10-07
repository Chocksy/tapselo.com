import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { runLocalChecks } from "../src/lib/a4200/pipeline.ts";
import { collapseVatXsdWarnings } from "../src/lib/a4200/validate-xsd.ts";
import type { CheckerIssue } from "../src/lib/a4200/types.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");
const DATECS = path.join(FIX, "datecs-anon");

function load(...entries: { name: string; path: string }[]) {
  return ingestBuffers(
    entries.map((e) => ({ name: e.name, data: new Uint8Array(fs.readFileSync(e.path)) })),
  ).files;
}

test("opis export month later than day files does not PERIOD_MISMATCH (Datecs anon)", () => {
  const entries = fs.readdirSync(DATECS).map((n) => ({
    name: n,
    path: path.join(DATECS, n),
  }));
  const files = load(...entries);
  const issues = runLocalChecks(files);
  assert.ok(!issues.some((i) => i.code === "PERIOD_MISMATCH"));
});

test("p7b and xml for the same Z count as one day", () => {
  const dayXml = path.join(FIX, "day-z001.xml");
  const bytes = new Uint8Array(fs.readFileSync(dayXml));
  const files = load(
    { name: "opis-good.xml", path: path.join(FIX, "opis-good.xml") },
    { name: "day-z002.xml", path: path.join(FIX, "day-z002.xml") },
    { name: "1234567890_Z0001.xml", path: dayXml },
    { name: "1234567890_Z0001.p7b", path: dayXml },
  );
  const issues = runLocalChecks(files);
  const codes = issues.map((i) => i.code);
  assert.ok(!codes.includes("DUPLICATE_Z"));
  assert.ok(!codes.includes("Z_COUNT_MISMATCH"));
  assert.ok(!codes.includes("MISSING_Z"));
});

test("collapseVatXsdWarnings merges cota errors into one warning", () => {
  const many: CheckerIssue[] = Array.from({ length: 50 }, (_, i) => ({
    severity: "error",
    code: "XSD_COTA_NEW_VAT",
    title: "x",
    ceInseamna: "y",
    ceFaci: "z",
    file: `bon-${i}`,
  }));
  const out = collapseVatXsdWarnings(many);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, "warning");
  assert.equal(out[0].code, "XSD_COTA_NEW_VAT");
  assert.match(out[0].ceInseamna, /50/);
});
