import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { runLocalChecks } from "../src/lib/a4200/pipeline.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

function load(...names: string[]) {
  return ingestBuffers(
    names.map((n) => ({ name: n, data: new Uint8Array(fs.readFileSync(path.join(FIX, n))) })),
  ).files;
}

test("good opis + two days has no cross-check errors", () => {
  const files = load("opis-good.xml", "day-z001.xml", "day-z002.xml");
  const issues = runLocalChecks(files);
  const codes = issues.map((i) => i.code);
  assert.deepEqual(codes, []);
});

test("missing day Z2 is reported", () => {
  const files = load("opis-good.xml", "day-z001.xml");
  const issues = runLocalChecks(files);
  assert.ok(issues.some((i) => i.code === "MISSING_Z"));
});

test("duplicate Z and wrong NUI", () => {
  const dup = runLocalChecks(load("opis-good.xml", "day-z001.xml", "day-z001.xml"));
  assert.ok(dup.some((i) => i.code === "DUPLICATE_Z"));
  const nui = runLocalChecks(load("opis-good.xml", "day-wrong-nui.xml"));
  assert.ok(nui.some((i) => i.code === "NUI_MISMATCH"));
});

test("wrong month and Z out of range", () => {
  const month = runLocalChecks(load("opis-good.xml", "day-z001.xml", "day-z002.xml", "day-wrong-month.xml"));
  assert.ok(month.some((i) => i.code === "PERIOD_MISMATCH"));
  const range = runLocalChecks(load("opis-good.xml", "day-z001.xml", "day-z999.xml"));
  assert.ok(range.some((i) => i.code === "Z_OUT_OF_RANGE"));
});

test("foreign file warning", () => {
  const files = load("opis-good.xml", "day-z001.xml", "day-z002.xml", "foreign-readme.txt");
  assert.ok(files.some((f) => f.kind === "foreign"));
  assert.ok(runLocalChecks(files).some((i) => i.code === "FOREIGN_FILES"));
});
