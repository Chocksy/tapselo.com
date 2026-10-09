import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  anafExportFilename,
  isPdfBytes,
  prepareSignedPdfForAnaf,
} from "../src/lib/a4200/signed-pdf.ts";
import { stripPdfLtvIncrement } from "../src/lib/a4200/strip-pdf-ltv.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200/pdf");

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIX, name)));
}

test("anafExportFilename uses _PENTRU-ANAF suffix", () => {
  assert.equal(anafExportFilename("Perioada_raportare.pdf"), "Perioada_raportare_PENTRU-ANAF.pdf");
});

test("prepareSignedPdfForAnaf rejects non-PDF", () => {
  const res = prepareSignedPdfForAnaf(new TextEncoder().encode("not a pdf"), "x.pdf");
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "not_pdf");
});

test("prepareSignedPdfForAnaf rejects unsigned fixture", () => {
  const res = prepareSignedPdfForAnaf(readFixture("unsigned.pdf"), "unsigned.pdf");
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "unsigned");
});

test("signed-with-ltv-tail: strip removes DSS tail and keeps valid PDF header", () => {
  const raw = readFixture("signed-with-ltv-tail.pdf");
  assert.ok(isPdfBytes(raw));
  const res = prepareSignedPdfForAnaf(raw, "declarare.pdf");
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.strippedIncrement, true);
    assert.equal(res.downloadName, "declarare_PENTRU-ANAF.pdf");
    assert.ok(isPdfBytes(res.bytes));
    const text = new TextDecoder("latin1").decode(res.bytes);
    assert.match(text, /%%EOF/);
    assert.ok(!text.includes("/Type /DSS"));
    assert.ok(res.bytes.length < raw.length);
  }
});

test("signed-clean: no strip message path", () => {
  const raw = readFixture("signed-clean.pdf");
  const res = prepareSignedPdfForAnaf(raw, "Perioada.pdf");
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.strippedIncrement, false);
    assert.equal(res.bytes.length, raw.length);
  }
});

test("signed-tampered fixture is rejected", () => {
  const res = prepareSignedPdfForAnaf(readFixture("signed-tampered.pdf"), "t.pdf");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(["broken_signature", "tampered", "unsigned"].includes(res.code));
  }
});

test("stripPdfLtvIncrement uses last ByteRange when multiple are present", () => {
  const content = "%PDF-1.4\nbody %%EOF\n";
  const tail = "LTV_TAIL";
  const firstBr = `/ByteRange [0 10 0 0]\n`;
  const signedLen = firstBr.length + content.length;
  const lastBr = `/ByteRange [0 ${signedLen} 0 0]\n`;
  const pdfBytes = new TextEncoder().encode(firstBr + lastBr + content + tail);
  const res = stripPdfLtvIncrement(pdfBytes);
  assert.equal(res.ok, true);
  assert.equal(res.strippedIncrement, true);
  const text = new TextDecoder().decode(res.stripped!);
  assert.ok(!text.includes("LTV_TAIL"));
});
