import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decodeDukErrTxt } from "../src/lib/a4200/duk-decoder.ts";

const FIX = path.join(import.meta.dirname, "fixtures/a4200");

test("DUKIntegrator err.txt lines map to known explanations", () => {
  const text = fs.readFileSync(path.join(FIX, "sample.err.txt"), "utf8");
  const lines = decodeDukErrTxt(text);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].explained, true);
  assert.equal(lines[1].explained, true);
  assert.equal(lines[2].explained, true);
  assert.match(lines[0].title ?? "", /spa/i);
});
