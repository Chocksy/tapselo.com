import { test } from "node:test";
import assert from "node:assert/strict";
import { ean13Modules, ean13Svg, eanCheckDigit, isValidEan, isValidEan13 } from "../src/lib/ean13.ts";

test("check digits of known codes", () => {
  assert.equal(eanCheckDigit("590123412345"), 7);
  assert.equal(eanCheckDigit("400638133393"), 1);
  assert.equal(eanCheckDigit("978030640615"), 7);
  assert.equal(eanCheckDigit("9638507"), 4);
  assert.equal(eanCheckDigit("7351353"), 7);
  assert.equal(eanCheckDigit("123"), null);
  assert.equal(eanCheckDigit("59012341234a"), null);
});

test("valid and invalid codes", () => {
  for (const ok of ["5901234123457", "4006381333931", "9780306406157", "96385074", "73513537"]) assert.ok(isValidEan(ok), ok);
  for (const bad of ["5901234123458", "5941234567890", "96385075", "", "12345678901", "590123412345a", null, 5901234123457]) {
    assert.equal(isValidEan(bad), false, String(bad));
  }
  assert.ok(isValidEan13("5901234123457"));
  assert.equal(isValidEan13("96385074"), false);
});

test("EAN-13 modules: 95 wide with guards and the parity of the first digit", () => {
  const m = ean13Modules("5901234123457")!;
  assert.equal(m.length, 95);
  assert.equal(m.slice(0, 3), "101");
  assert.equal(m.slice(45, 50), "01010");
  assert.equal(m.slice(92), "101");
  // first digit 5 -> LGGLLG; digit 9 in L code
  assert.equal(m.slice(3, 10), "0001011");
  // digit 0 in G code
  assert.equal(m.slice(10, 17), "0100111");
  // last digit 7 in R code
  assert.equal(m.slice(85, 92), "1000100");
  assert.equal(ean13Modules("5901234123458"), null);
});

test("EAN-13 SVG: bars, longer guard bars, all 13 digits under the bars", () => {
  const svg = ean13Svg("5901234123457")!;
  assert.match(svg, /^<svg class="ean" xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 113 61"/);
  assert.match(svg, /aria-label="Cod de bare 5901234123457"/);
  assert.match(svg, /M11 0h1v56h-1z/); // start guard, long
  assert.match(svg, /v50h/); // data bars, short
  const digits = [...svg.matchAll(/<text [^>]*>(\d)<\/text>/g)].map((x) => x[1]).join("");
  assert.equal(digits, "5901234123457");
  assert.equal(ean13Svg("5941234567890"), null);
  assert.equal(ean13Svg("96385074"), null);
});
