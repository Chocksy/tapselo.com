import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestFileList } from "../src/lib/a4200/ingest.ts";
import { buildCrossCheckInput, runLocalChecks } from "../src/lib/a4200/pipeline.ts";
import { buildOpisCheckSummary } from "../src/lib/a4200/check-summary.ts";
import { validateXML } from "xmllint-wasm";
import { validateAgainstXsd } from "../src/lib/a4200/validate-xsd.ts";
import {
  buildVerificationPlainSummary,
  canProceedToPdfStep,
  countBlockingIssues,
  formatPeriodLabel,
  primaryButtonLabel,
  stepHeading,
  WIZARD_STEP_COUNT,
} from "../src/lib/a4200/wizard.ts";

const xsd4200 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4200_20180910.xsd"), "utf8");
const xsd4203 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4203_20180927.xsd"), "utf8");

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

test("wizard has four steps with Romanian headings", () => {
  assert.equal(WIZARD_STEP_COUNT, 4);
  assert.match(stepHeading(1), /Încarcă arhiva/);
  assert.match(stepHeading(4), /ANAF/);
});

test("primary button labels follow step context", () => {
  assert.equal(primaryButtonLabel(1, { hasFiles: false }), "Alege fișierele");
  assert.equal(primaryButtonLabel(1, { hasFiles: true }), "Verifică arhiva");
  assert.equal(primaryButtonLabel(2, { checksOk: true }), "Continuă: PDF și semnare");
  assert.equal(primaryButtonLabel(2, { checksOk: false }), "Încarcă din nou arhiva");
  assert.equal(primaryButtonLabel(3, {}), "Descarcă PDF pentru semnare");
  assert.equal(primaryButtonLabel(3, { onStep3ReadyForAnaf: true }), "Continuă: încărcare ANAF");
});

test("uploaded anonymized fixtures: plain summary when complete", async () => {
  const dir = path.join(FIX, "datecs-anon");
  const names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".p7b"));
  const files = names.map((name) => {
    const buf = fs.readFileSync(path.join(dir, name));
    return new File([buf], name, { type: "application/octet-stream" });
  });
  const { files: classified } = await ingestFileList(files);
  const local = runLocalChecks(classified);
  const xsd = await validateAgainstXsd(
    validateXML,
    classified
      .filter((f) => f.xml && (f.kind === "opis" || f.kind === "day"))
      .map((f) => ({
        name: f.name,
        xml: f.xml!,
        schema: f.kind === "opis" ? xsd4200 : xsd4203,
      })),
  );
  const issues = [...local, ...xsd];
  const { input } = buildCrossCheckInput(classified);
  const summary = buildOpisCheckSummary(input);
  assert.ok(summary, "expected opis summary");
  const period = formatPeriodLabel(summary!.opis);
  assert.ok(period, "expected period from opis");

  const plain = buildVerificationPlainSummary(summary, issues);
  assert.equal(countBlockingIssues(issues), 0);
  assert.equal(plain.ok, true);
  assert.ok(plain.foundLine?.includes("Z 11–13") || plain.foundLine?.includes("Z 11"));
  assert.equal(canProceedToPdfStep(plain), plain.ok);
});

test("missing day produces missing line in plain summary", async () => {
  const files = ["opis-good.xml", "day-z001.xml"].map((name) => {
    const buf = fs.readFileSync(path.join(FIX, name));
    return new File([buf], name, { type: "application/xml" });
  });
  const { files: classified } = await ingestFileList(files);
  const issues = runLocalChecks(classified);
  const { input } = buildCrossCheckInput(classified);
  const summary = buildOpisCheckSummary(input);
  const plain = buildVerificationPlainSummary(summary, issues);
  assert.equal(plain.ok, false);
  assert.ok(plain.missingLines.some((l) => /Lipsește raportul Z2/.test(l)));
});
