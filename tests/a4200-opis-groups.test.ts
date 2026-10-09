import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { disambiguateP7bPayloadNames } from "../src/lib/a4200/collect-p7b.ts";
import { runCrossChecks } from "../src/lib/a4200/crosscheck.ts";
import { partitionUploadByOpis, runFullUploadChecks } from "../src/lib/a4200/opis-groups.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

function load(...names: string[]) {
  return ingestBuffers(
    names.map((n) => ({ name: n, data: new Uint8Array(fs.readFileSync(path.join(FIX, n))) })),
  ).files;
}

test("multi-opis upload partitions days per opis without MULTIPLE_OPIS", () => {
  const files = load(
    "opis-may-101-103.xml",
    "opis-june-104-105.xml",
    "day-z101.xml",
    "day-z102.xml",
    "day-z103.xml",
    "day-z104.xml",
    "day-z105.xml",
  );
  const { groups, uploadIssues, groups: checked } = runFullUploadChecks(files);
  assert.equal(groups.length, 2);
  assert.ok(!uploadIssues.some((i) => i.code === "MULTIPLE_OPIS"));
  assert.ok(checked.every((g) => g.readyForPdf));
  assert.ok(!checked.some((g) => g.issues.some((i) => i.code === "PERIOD_MISMATCH")));
});

test("day outside every opis range is unassigned", () => {
  const files = load("opis-may-101-103.xml", "day-z104.xml");
  const part = partitionUploadByOpis(files);
  assert.equal(part.unassignedDays.length, 1);
  assert.equal(part.groups[0].days.length, 0);
});

test("PERIOD_MISMATCH lists distinct months with Z ranges", () => {
  const files = load(
    "opis-cross-month.xml",
    "day-z101.xml",
    "day-z102.xml",
    "day-z103.xml",
    "day-z104.xml",
    "day-z105.xml",
  );
  const { groups } = runFullUploadChecks(files);
  assert.equal(groups.length, 1);
  const mismatch = groups[0].issues.find((i) => i.code === "PERIOD_MISMATCH");
  assert.ok(mismatch);
  assert.match(mismatch!.ceInseamna, /mai 2025/);
  assert.match(mismatch!.ceInseamna, /iunie 2025/);
  assert.match(mismatch!.ceInseamna, /Z 101/);
  assert.doesNotMatch(mismatch!.ceFaci, /foldere distincte/i);
});

test("disambiguateP7bPayloadNames keeps two Perioada_raportare.p7b entries", () => {
  const out = disambiguateP7bPayloadNames([
    { name: "may/Perioada_raportare.p7b", data: new Uint8Array([1]) },
    { name: "june/Perioada_raportare.p7b", data: new Uint8Array([2]) },
  ]);
  assert.equal(out.length, 2);
  assert.notEqual(out[0].name, out[1].name);
});

test("legacy crosscheck still flags multiple opis in one flat selection", () => {
  const f = load("opis-may-101-103.xml", "opis-june-104-105.xml");
  const opisFiles = f.filter((x) => x.kind === "opis").map((x) => x.name);
  const issues = runCrossChecks({
    opis: null,
    days: [],
    foreign: [],
    opisFiles,
  });
  assert.ok(issues.some((i) => i.code === "MULTIPLE_OPIS"));
});
