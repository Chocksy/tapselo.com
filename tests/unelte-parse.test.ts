import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRoNumber } from "../src/lib/unelte/parse.ts";

const ok = (value: number) => ({ kind: "ok", value });

test("parseRoNumber: Romanian format with comma decimals and dot thousands", () => {
  assert.deepEqual(parseRoNumber("1.234,50"), ok(1234.5));
  assert.deepEqual(parseRoNumber("3.480,20"), ok(3480.2));
  assert.deepEqual(parseRoNumber("4,5"), ok(4.5));
  assert.deepEqual(parseRoNumber("1 234,5"), ok(1234.5));
  assert.deepEqual(parseRoNumber("12.345.678"), ok(12345678));
  assert.deepEqual(parseRoNumber("1.500"), ok(1500));
});

test("parseRoNumber: a single dot that is not a thousands group is a decimal mark", () => {
  assert.deepEqual(parseRoNumber("4.50"), ok(4.5));
  assert.deepEqual(parseRoNumber(".5"), ok(0.5));
  assert.deepEqual(parseRoNumber("12"), ok(12));
  assert.deepEqual(parseRoNumber("0"), ok(0));
});

test("parseRoNumber: rounds to the requested decimals", () => {
  assert.deepEqual(parseRoNumber("1,005"), ok(1.01));
  assert.deepEqual(parseRoNumber("1,2345", 3), ok(1.235));
});

test("parseRoNumber: empty and invalid input", () => {
  assert.deepEqual(parseRoNumber(""), { kind: "empty" });
  assert.deepEqual(parseRoNumber("   "), { kind: "empty" });
  for (const s of ["-3", "abc", "1.2.3", "1,2,3", "12.34,5", "1e3", "12 lei"]) {
    assert.deepEqual(parseRoNumber(s), { kind: "invalid" }, s);
  }
});
