import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeEan, checkDigitInfo, codeInfoHtml, decodeGs1Prefix, formatEan13, prefixNote, type PrefixKind } from "../src/lib/unelte/gs1.ts";

const label = (ean: string) => decodeGs1Prefix(ean)?.label;

test("decodeGs1Prefix: countries by the first three digits", () => {
  assert.deepEqual(decodeGs1Prefix("5941234000013"), { prefix: "594", label: "România", kind: "country" });
  assert.equal(label("4006381333931"), "Germania");
  assert.equal(label("5449000000996"), "Belgia și Luxemburg");
  assert.equal(label("3017620422003"), "Franța și Monaco");
  assert.equal(label("8000500310427"), "Italia, San Marino și Vatican");
  assert.equal(label("5900000000000"), "Polonia");
  assert.equal(label("5990000000000"), "Ungaria");
  assert.equal(label("3800000000000"), "Bulgaria");
  assert.equal(label("4840000000000"), "Republica Moldova");
  assert.equal(label("8690000000000"), "Turcia");
  assert.equal(label("6900000000000"), "China");
  assert.equal(label("0036000291452"), "SUA și Canada");
  assert.equal(label("9000000000000"), "Austria");
  assert.equal(label("9190000000000"), "Austria");
});

test("decodeGs1Prefix: range edges, special kinds and gaps", () => {
  assert.equal(decodeGs1Prefix("2000000000008")?.kind, "restricted");
  assert.equal(decodeGs1Prefix("2990000000000")?.kind, "restricted");
  assert.equal(decodeGs1Prefix("0200000000000")?.kind, "restricted");
  assert.equal(decodeGs1Prefix("9780306406157")?.kind, "book");
  assert.equal(decodeGs1Prefix("9771234567003")?.kind, "serial");
  assert.equal(decodeGs1Prefix("9900000000000")?.kind, "coupon");
  assert.deepEqual(decodeGs1Prefix("1400000000000"), { prefix: "140", label: "Prefix nealocat de GS1", kind: "unassigned" });
  assert.equal(decodeGs1Prefix("5950000000000")?.kind, "unassigned");
  assert.equal(decodeGs1Prefix("4400000000000")?.label, "Germania");
  assert.equal(decodeGs1Prefix("4410000000000")?.kind, "unassigned");
});

test("decodeGs1Prefix / checkDigitInfo: only 13 digits", () => {
  for (const bad of ["", "594", "96385074", "594123400001", "59412340000133", "594123400001x"]) {
    assert.equal(decodeGs1Prefix(bad), null, bad);
    assert.equal(checkDigitInfo(bad), null, bad);
  }
});

test("checkDigitInfo: valid and wrong check digits", () => {
  assert.deepEqual(checkDigitInfo("5941234000013"), { valid: true, actual: 3, expected: 3 });
  assert.deepEqual(checkDigitInfo("5941234000014"), { valid: false, actual: 4, expected: 3 });
  assert.deepEqual(checkDigitInfo("4006381333931"), { valid: true, actual: 1, expected: 1 });
  assert.deepEqual(checkDigitInfo("0000000000000"), { valid: true, actual: 0, expected: 0 });
});

test("analyzeEan: normalizes input and decides when to search", () => {
  const ok = analyzeEan(" 594-1234 000013 ");
  assert.equal(ok.ok && ok.ean, "5941234000013");
  assert.equal(ok.ok && ok.searchable, true);
  const upc = analyzeEan("036000291452");
  assert.equal(upc.ok && upc.ean, "0036000291452");
  const wrong = analyzeEan("5941234000014");
  assert.equal(wrong.ok && wrong.searchable, false, "decoded but not searched");
  assert.equal(wrong.ok && wrong.prefix.label, "România");
  const store = analyzeEan("2000000000008");
  assert.equal(store.ok && store.check.valid, true);
  assert.equal(store.ok && store.searchable, false);
  for (const bad of ["", "abc", "96385074", "12345678901234"]) assert.deepEqual(analyzeEan(bad), { ok: false }, bad);
});

test("codeInfoHtml: grouped code, prefix country and check digit verdict", () => {
  const a = analyzeEan("5941234000013");
  assert.ok(a.ok);
  const html = codeInfoHtml(a);
  assert.match(html, /5 941234 000013/);
  assert.match(html, /594 — România/);
  assert.match(html, /data-check="ok">3 — corectă/);
  assert.match(html, /nu neapărat țara în care a fost fabricat/);

  const bad = analyzeEan("5941234000014");
  assert.ok(bad.ok);
  assert.match(codeInfoHtml(bad), /4 — greșită \(cifra corectă ar fi 3\)/);
});

test("prefixNote: a Romanian note for every prefix kind, comma-below diacritics", () => {
  const kinds: PrefixKind[] = ["country", "restricted", "coupon", "book", "serial", "special", "unassigned"];
  for (const k of kinds) {
    const note = prefixNote(k);
    assert.ok(note.length > 10, k);
    assert.doesNotMatch(note, /[şţŞŢ]/, `${k}: cedilla diacritics`);
  }
});

test("formatEan13", () => {
  assert.equal(formatEan13("5941234000013"), "5 941234 000013");
  assert.equal(formatEan13("123"), "123");
});
