import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { runFullUploadChecks } from "../src/lib/a4200/opis-groups.ts";
import { buildVerificationPlainSummary } from "../src/lib/a4200/wizard.ts";
import { buildOpisCheckSummary } from "../src/lib/a4200/check-summary.ts";
import { buildCrossCheckInput } from "../src/lib/a4200/pipeline.ts";
import {
  buildSpvAnafMessage,
  crossMonthPdfCardLabel,
  formatMonthRangeKey,
} from "../src/lib/a4200/mixed-month.ts";
import { splitDaysByMonth } from "../src/lib/a4200/day-groups.ts";
import { buildPdfDownloadName } from "../services/a4200-pdf/src/lib/pdf-filename.mjs";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

function loadCrossMonthBundle() {
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
  return { files, input };
}

test("cross-month single opis is ready for PDF with fallback flag", () => {
  const { files } = loadCrossMonthBundle();
  const { groups } = runFullUploadChecks(files);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].crossMonthFallback, true);
  assert.equal(groups[0].readyForPdf, true);
  const mismatch = groups[0].issues.find((i) => i.code === "PERIOD_MISMATCH");
  assert.equal(mismatch?.severity, "warning");
});

test("plain summary allows continue when cross-month fallback applies", () => {
  const { input } = loadCrossMonthBundle();
  const summary = buildOpisCheckSummary(input);
  const plain = buildVerificationPlainSummary(summary, [], input.days);
  assert.equal(plain.ok, true);
  assert.equal(plain.crossMonthFallback, true);
  assert.match(plain.headline, /mai multe luni/);
  assert.ok(plain.mixedMonthHtml?.includes("OPANAF nr. 627/2018"));
  assert.ok(plain.spvAnafMessage);
});

test("cross-month PDF card label includes export pe mai multe luni", () => {
  const { input } = loadCrossMonthBundle();
  const label = crossMonthPdfCardLabel(input.days, input.opis!);
  assert.equal(label, "mai–iunie 2025 · Z 101–Z 105 · 5 zile (export pe mai multe luni)");
});

test("month range key for filename", () => {
  const { input } = loadCrossMonthBundle();
  const key = formatMonthRangeKey(splitDaysByMonth(input.days));
  assert.equal(key, "2025-05_2025-06");
});

test("buildPdfDownloadName uses month range for cross-month days", () => {
  const opis = fs.readFileSync(path.join(FIX, "opis-cross-month.xml"));
  const dayMay = fs.readFileSync(path.join(FIX, "day-z101.xml"));
  const dayJune = fs.readFileSync(path.join(FIX, "day-z104.xml"));
  const name = buildPdfDownloadName(opis, {
    "Perioada_raportare.p7b": opis,
    "9999999901_Z0101.p7b": dayMay,
    "9999999901_Z0104.p7b": dayJune,
  });
  assert.equal(name, "A4200_1234567890_2025-05_2025-06_Z101-Z105.pdf");
});

test("SPV message text for cross-month export", () => {
  const { input } = loadCrossMonthBundle();
  const msg = buildSpvAnafMessage(input.days, input.opis!);
  assert.equal(
    msg,
    `Bună ziua,

Vă informez că declarația A4200 înregistrată la octombrie 2026 acoperă rapoartele Z 101–Z 105, pentru intervalul 30.05.2025 – 02.06.2025, așa cum au fost exportate din casa de marcat.

nr. recipisă: ________

Vă mulțumesc.`,
  );
});

test("multi-opis upload: cross-month group has fallback, single-month group does not", () => {
  const names = [
    "opis-good.xml",
    "day-z001.xml",
    "day-z002.xml",
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
  const { groups } = runFullUploadChecks(files);
  assert.equal(groups.length, 2);
  const cross = groups.find((g) => g.group.opis.nrRapI === 101);
  const single = groups.find((g) => g.group.opis.nrRapI === 1);
  assert.ok(cross?.crossMonthFallback);
  assert.equal(single?.crossMonthFallback, false);
  assert.ok(single?.readyForPdf);
  assert.ok(cross?.readyForPdf);
});
