import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractXmlPayload } from "../src/lib/a4200/unwrap.ts";
import { ingestBuffers } from "../src/lib/a4200/ingest.ts";
import { classifyXml } from "../src/lib/a4200/parse.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

test("extractXmlPayload reads plain opis and day XML", () => {
  const opis = fs.readFileSync(path.join(FIX, "opis-good.xml"));
  const day = fs.readFileSync(path.join(FIX, "day-z001.xml"));
  assert.equal(classifyXml(extractXmlPayload(opis)!.xml), "opis");
  assert.equal(classifyXml(extractXmlPayload(day)!.xml), "day");
});

test("extractXmlPayload finds XML inside binary PKCS#7 prefix", () => {
  const xml = fs.readFileSync(path.join(FIX, "opis-good.xml"));
  const wrapped = new Uint8Array([0x30, 0x82, 0x01, 0x00, ...xml]);
  const out = extractXmlPayload(wrapped);
  assert.ok(out);
  assert.equal(out.kind, "opis");
  assert.match(out.xml, /<mReg\b/);
});

test("ingest marks foreign files", () => {
  const foreign = fs.readFileSync(path.join(FIX, "foreign-readme.txt"));
  const { files } = ingestBuffers([{ name: "readme.txt", data: foreign }]);
  assert.equal(files[0].kind, "foreign");
});
