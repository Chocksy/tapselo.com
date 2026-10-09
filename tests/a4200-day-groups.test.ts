import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { buildCrossCheckInput } from "../src/lib/a4200/pipeline.ts";
import { splitDaysByMonth, formatSegmentZRange } from "../src/lib/a4200/day-groups.ts";
import { buildVerificationPlainSummary, formatPeriodLabelFromOpis } from "../src/lib/a4200/wizard.ts";
import { buildOpisCheckSummary } from "../src/lib/a4200/check-summary.ts";
import { buildLateDeadlineLines, buildServiceTechnicianMessage } from "../src/lib/a4200/mixed-month.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

function loadDays(...names: string[]) {
  const { files } = ingestBuffers(
    names.map((n) => ({ name: n, data: new Uint8Array(fs.readFileSync(path.join(FIX, n))) })),
  );
  const { input } = buildCrossCheckInput(files);
  return input.days;
}

test("splitDaysByMonth segments May and June at month boundary", () => {
  const days = loadDays("day-z101.xml", "day-z102.xml", "day-z103.xml", "day-z104.xml", "day-z105.xml");
  const segments = splitDaysByMonth(days);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].luna, 5);
  assert.equal(segments[0].zFrom, 101);
  assert.equal(segments[0].zTo, 103);
  assert.equal(segments[0].count, 3);
  assert.equal(segments[1].luna, 6);
  assert.equal(segments[1].zFrom, 104);
  assert.equal(segments[1].zTo, 105);
  assert.equal(formatSegmentZRange(segments[0]), "Z 101–Z 103");
});

test("plain summary never uses opis export month when day files exist", () => {
  const names = [
    "opis-cross-month.xml",
    "day-z101.xml",
    "day-z102.xml",
    "day-z103.xml",
    "day-z104.xml",
    "day-z105.xml",
  ];
  const { files } = ingestBuffers(
    names.map((n) => ({ name: n, data: new Uint8Array(fs.readFileSync(path.join(FIX, n))) })),
  );
  const { input } = buildCrossCheckInput(files);
  const summary = buildOpisCheckSummary(input);
  assert.ok(summary);
  const exportMonth = formatPeriodLabelFromOpis(summary!.opis);
  assert.equal(exportMonth, "octombrie 2026");
  const plain = buildVerificationPlainSummary(summary, [], input.days);
  assert.notEqual(plain.periodLabel, exportMonth);
  assert.match(plain.periodLabel ?? "", /mai–iunie 2025/);
  assert.match(plain.foundLine ?? "", /2 luni/);
  assert.ok(plain.mixedMonthHtml);
  assert.match(plain.serviceTechnicianMessage ?? "", /Z 101–Z 103/);
  assert.match(plain.serviceTechnicianMessage ?? "", /Z 104–Z 105/);
});

test("late deadline line when reporting month has passed", () => {
  const days = loadDays("day-z101.xml", "day-z102.xml", "day-z103.xml");
  const segments = splitDaysByMonth(days);
  const lines = buildLateDeadlineLines(segments, new Date("2026-10-09"));
  assert.ok(lines.some((l) => /Termenul pentru mai 2025/.test(l)));
  assert.ok(lines.some((l) => /20\.06\.2025/.test(l)));
});

test("service technician message lists Z intervals", () => {
  const days = loadDays("day-z101.xml", "day-z104.xml");
  const segments = splitDaysByMonth(days);
  const msg = buildServiceTechnicianMessage(segments);
  assert.match(msg, /La cerere ANAF/);
});
