import { test } from "node:test";
import assert from "node:assert/strict";
import { stripPdfLtvIncrement } from "../src/lib/a4200/strip-pdf-ltv.ts";

test("stripPdfLtvIncrement truncates bytes after ByteRange end", () => {
  const content = "%PDF-1.4\nbody %%EOF\n";
  const tail = "LTV_INCREMENT_GARBAGE";
  const headerLen = `/ByteRange [0 99999 0 0]\n`.length;
  const signedLen = headerLen + content.length;
  const header = `/ByteRange [0 ${signedLen} 0 0]\n`;
  const pdfBytes = new TextEncoder().encode(header + content + tail);
  const res = stripPdfLtvIncrement(pdfBytes);
  assert.equal(res.ok, true);
  const text = new TextDecoder().decode(res.stripped!);
  assert.match(text, /%%EOF/);
  assert.ok(!text.includes("LTV_INCREMENT"));
});

test("stripPdfLtvIncrement leaves file unchanged when no tail past ByteRange", () => {
  const content = "%PDF-1.4\nbody %%EOF\n";
  let header = `/ByteRange [0 0 0 0]\n`;
  let signedLen = header.length + content.length;
  header = `/ByteRange [0 ${signedLen} 0 0]\n`;
  signedLen = header.length + content.length;
  header = `/ByteRange [0 ${signedLen} 0 0]\n`;
  const pdf = new TextEncoder().encode(header + content);
  const res = stripPdfLtvIncrement(pdf);
  assert.equal(res.ok, true);
  assert.equal(res.stripped!.length, pdf.length);
});

test("stripPdfLtvIncrement fails without ByteRange", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\nno signature\n");
  const res = stripPdfLtvIncrement(pdf);
  assert.equal(res.ok, false);
});
