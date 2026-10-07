import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { buildCrossCheckInput, runLocalChecks } from "../src/lib/a4200/pipeline.ts";
import {
  buildWizardStep2View,
  formatPerioadaRo,
  wizardProgressLabel,
  WIZARD_STEP_COUNT,
} from "../src/lib/a4200/wizard-summary.ts";
import { collectP7bFromFiles, p7bPayloadsToZip } from "../src/lib/a4200/collect-p7b.ts";
import { zipSync } from "fflate";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");
const DATECS = path.join(import.meta.dirname, "fixtures/a4200/datecs-anon");

test("wizard progress labels", () => {
  assert.equal(WIZARD_STEP_COUNT, 4);
  assert.equal(wizardProgressLabel(1), "Pasul 1 din 4");
  assert.equal(wizardProgressLabel(4), "Pasul 4 din 4");
});

test("formatPerioadaRo uses Romanian month names", () => {
  assert.equal(formatPerioadaRo(2026, 6), "iunie 2026");
});

test("step 2 copy: complete Datecs anonymized set is OK", () => {
  const entries = fs
    .readdirSync(DATECS)
    .filter((n) => n.endsWith(".p7b"))
    .map((name) => ({
      name,
      data: new Uint8Array(fs.readFileSync(path.join(DATECS, name))),
    }));
  const { files } = ingestBuffers(entries);
  const input = buildCrossCheckInput(files).input;
  const localIssues = runLocalChecks(files);
  const view = buildWizardStep2View(input, localIssues);
  assert.equal(view.ok, true);
  assert.match(view.headline, /Z11–Z13/);
  assert.equal(view.missingZ.length, 0);
});

test("step 2 copy: missing day lists Z numbers", () => {
  const files = ingestBuffers(
    ["opis-good.xml", "day-z001.xml"].map((n) => ({
      name: n,
      data: new Uint8Array(fs.readFileSync(path.join(FIX, n))),
    })),
  ).files;
  const input = buildCrossCheckInput(files).input;
  const localIssues = runLocalChecks(files);
  const view = buildWizardStep2View(input, localIssues);
  assert.equal(view.ok, false);
  assert.ok(view.missingZ.includes(2));
});

test("step 2 copy: anonymized upload zip passes local checks", () => {
  const names = fs.readdirSync(DATECS).filter((n) => n.endsWith(".p7b"));
  const bufs = names.map((name) => ({
    name,
    data: new Uint8Array(fs.readFileSync(path.join(DATECS, name))),
  }));
  const { files } = ingestBuffers(bufs);
  const input = buildCrossCheckInput(files).input;
  const view = buildWizardStep2View(input, runLocalChecks(files));
  assert.equal(view.ok, true);
  assert.match(view.headline, /Z11–Z13/);
});

test("collectP7bFromFiles extracts from zip buffer", async () => {
  const names = fs.readdirSync(DATECS).filter((n) => n.endsWith(".p7b"));
  const zipEntries: Record<string, Uint8Array> = {};
  for (const name of names) {
    zipEntries[name] = new Uint8Array(fs.readFileSync(path.join(DATECS, name)));
  }
  const data = zipSync(zipEntries);
  const file = new File([data], "fixtures.zip", { type: "application/zip" });
  const payloads = await collectP7bFromFiles([file]);
  assert.equal(payloads.length, 4);
  const zipped = p7bPayloadsToZip(payloads);
  assert.ok(zipped.length > 100);
});
