import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateXML } from "xmllint-wasm";
import { validateAgainstXsd } from "../src/lib/a4200/validate-xsd.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");
const xsd4200 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4200_20180910.xsd"), "utf8");
const xsd4203 = fs.readFileSync(path.join(import.meta.dirname, "../public/a4200/a4203_20180927.xsd"), "utf8");

test("synthetic good day passes A4203 XSD", async () => {
  const xml = fs.readFileSync(path.join(FIX, "day-z001.xml"), "utf8");
  const issues = await validateAgainstXsd(validateXML, [{ name: "d.xml", xml, schema: xsd4203 }]);
  assert.equal(issues.length, 0);
});

test("bad CIF opis fails XSD with explainable code", async () => {
  const xml = fs.readFileSync(path.join(FIX, "opis-bad-cif.xml"), "utf8");
  const issues = await validateAgainstXsd(validateXML, [{ name: "o.xml", xml, schema: xsd4200 }]);
  assert.ok(issues.length > 0);
  assert.equal(issues[0].code, "XSD_CIF");
});

test("idM too long on opis fails XSD", async () => {
  const xml = fs.readFileSync(path.join(FIX, "opis-long-idm.xml"), "utf8");
  const issues = await validateAgainstXsd(validateXML, [{ name: "o.xml", xml, schema: xsd4200 }]);
  assert.ok(issues.some((i) => i.code === "XSD_IDM_LEN"));
});
