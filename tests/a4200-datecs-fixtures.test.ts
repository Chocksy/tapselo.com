import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateXML } from "xmllint-wasm";
import { extractXmlPayload } from "../src/lib/a4200/unwrap.ts";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { buildCrossCheckInput, runLocalChecks } from "../src/lib/a4200/pipeline.ts";
import { buildOpisCheckSummary } from "../src/lib/a4200/check-summary.ts";
import { parseOpisXml } from "../src/lib/a4200/parse.ts";
import { validateAgainstXsd } from "../src/lib/a4200/validate-xsd.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200/datecs-anon");
const xsd4200 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4200_20180910.xsd"), "utf8");
const xsd4203 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4203_20180927.xsd"), "utf8");

/** Anonymized day exports omit rB and use 21% cote — only these XSD codes are expected. */
const DAY_XSD_ALLOWED = new Set(["XSD_COTA_NEW_VAT", "XSD_COTA_ENUM", "XSD_OTHER", "XSD_MISSING_ATTR"]);

function listP7b(): string[] {
  return fs.readdirSync(FIX).filter((n) => n.toLowerCase().endsWith(".p7b"));
}

test("Datecs anonymized p7b: CMS unwrap yields valid fiscal XML", () => {
  for (const name of listP7b()) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(FIX, name)));
    const out = extractXmlPayload(bytes);
    assert.ok(out, `${name} should unwrap`);
    assert.match(out!.xml, /^<\?xml/);
    if (out!.kind === "opis") assert.match(out!.xml, /<\/mReg>\s*$/);
    else assert.match(out!.xml, /<\/msj>\s*$/);
  }
});

test("Datecs anonymized p7b: XSD (opis strict, days allow 11%/21% cote warnings)", async () => {
  for (const name of listP7b()) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(FIX, name)));
    const out = extractXmlPayload(bytes)!;
    const schema = out.kind === "opis" ? xsd4200 : xsd4203;
    const issues = await validateAgainstXsd(validateXML, [{ name, xml: out.xml, schema }]);
    if (out.kind === "opis") {
      assert.equal(issues.length, 0, `opis XSD: ${issues[0]?.title}`);
    } else {
      for (const i of issues) {
        assert.ok(DAY_XSD_ALLOWED.has(i.code), `unexpected XSD ${i.code} on ${name}`);
      }
    }
  }
});

test("Datecs anonymized set: Z11–Z13 with three day files matching opis", () => {
  const entries = listP7b().map((name) => ({
    name,
    data: new Uint8Array(fs.readFileSync(path.join(FIX, name))),
  }));
  const { files } = ingestBuffers(entries);
  const { input } = buildCrossCheckInput(files);
  assert.ok(input.opis);
  const opisXml = files.find((f) => f.kind === "opis")!.xml!;
  const opis = parseOpisXml(opisXml);
  assert.equal(opis.nrRapI, 11);
  assert.equal(opis.nrRapF, 13);
  assert.equal(opis.cif, "1234567");
  assert.equal(opis.nui, "9999999901");

  const summary = buildOpisCheckSummary(input);
  assert.ok(summary);
  assert.equal(summary!.zRangeLabel, "Z11–Z13");
  assert.equal(summary!.expectedCount, 3);
  assert.equal(summary!.presentCount, 3);

  const blocking = runLocalChecks(files).filter((i) => i.severity === "error");
  assert.equal(blocking.length, 0, blocking.map((i) => i.code).join(", "));
});
