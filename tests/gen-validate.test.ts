import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containsUrl,
  roundTo,
  roundMoney,
  text,
  num,
  date,
  validateFlyer,
  validateLabels,
  validateNir,
  validateRecipe,
  validateCashbook,
  ValidationError,
  payloadBytes,
  MAX_PAYLOAD_BYTES,
  VAT_RATES,
} from "../src/lib/generators/validate.ts";
import { MOCK_DRAFTS } from "../src/lib/generators/mock.ts";

test("URL text is rejected, normal shop text and phones are not", () => {
  for (const bad of [
    "http://x.ro",
    "Vezi https://evil.example",
    "www.magazin",
    "ftp://host",
    "Comanda pe magazin.ro",
    "promo.com/oferta",
    "Shop.ONLINE",
    "HTTP",
    "abuz@tapselo.com",
  ]) {
    assert.ok(containsUrl(bad), bad);
    assert.throws(() => text(bad, "name", 80, true), ValidationError, bad);
  }
  for (const ok of ["Telemea de vaca", "Cafea Jacobs 250g", "Lapte 3,5% 1L", "S.C. Panviro S.R.L.", "Str. Garii nr.12 bl.A4 ap.3", "Sos. Romana 5", "Ulei 1.5 l"]) {
    assert.equal(containsUrl(ok), false, ok);
  }
  assert.equal(validateFlyer({ store_name: "Magazin", phone: "+40 722-123.456", products: [{ name: "Paine", price: 5, unit: "buc" }] }).phone, "+40 722-123.456");
  assert.throws(() => validateFlyer({ store_name: "Magazin", phone: "suna pe www.x", products: [{ name: "Paine", price: 5, unit: "buc" }] }), ValidationError);
  assert.throws(
    () => validateFlyer({ store_name: "Magazin", products: [{ name: "Vezi http://x", price: 5, unit: "buc" }] }),
    (e: unknown) => e instanceof ValidationError && e.field === "products[0].name" && /adresă web/.test(e.message),
  );
});

test("text: trim, control characters, length limits", () => {
  assert.equal(text("  Paine\u0000 alba\n\t ", "x", 80, true), "Paine alba");
  assert.equal(text("a​b", "x", 80, true), "a b");
  assert.equal(text(undefined, "x", 80), undefined);
  assert.equal(text("   ", "x", 80), undefined);
  assert.throws(() => text("", "x", 80, true), /Lipsește câmpul "x"/);
  assert.equal(text("a".repeat(80), "x", 80, true).length, 80);
  assert.throws(() => text("a".repeat(81), "x", 80, true), /maximul este 80/);
  assert.throws(() => text({}, "x", 80, true), /trebuie să fie text/);
  assert.equal(text(1234, "x", 80, true), "1234");
});

test("numbers: finite, range, decimals, comma input", () => {
  assert.equal(num("11,99", "p", 2, true), 11.99);
  assert.equal(num(1.005, "p", 2, true), 1.01);
  assert.equal(num(2.0005, "q", 3, true), 2.001);
  assert.equal(num(1_000_000, "p", 2, true), 1_000_000);
  assert.throws(() => num(1_000_000.01, "p", 2, true), ValidationError);
  assert.throws(() => num(-1, "p", 2, true), ValidationError);
  assert.throws(() => num(Infinity, "p", 2, true), ValidationError);
  assert.throws(() => num(NaN, "p", 2, true), ValidationError);
  assert.throws(() => num("12 lei", "p", 2, true), ValidationError);
  assert.equal(num(undefined, "p", 2), undefined);
});

test("rounding: half away from zero", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.675), 2.68);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(roundMoney(0.125), 0.13);
  assert.equal(roundMoney(-0.004), 0);
  assert.equal(roundTo(1.0005, 3), 1.001);
});

test("dates", () => {
  assert.equal(date("2026-10-05", "d", true), "2026-10-05");
  assert.equal(date("5.10.2026", "d", true), "2026-10-05");
  assert.throws(() => date("2026-02-30", "d", true), ValidationError);
  assert.throws(() => date("ieri", "d", true), ValidationError);
});

test("list sizes per kind", () => {
  const p = { name: "Paine", price: 5, unit: "buc" };
  assert.equal(validateFlyer({ store_name: "M", products: Array(24).fill(p) }).products.length, 24);
  assert.throws(() => validateFlyer({ store_name: "M", products: Array(25).fill(p) }), /maximul este 24/);
  assert.throws(() => validateFlyer({ store_name: "M", products: [] }), /cel puțin un element/);
  assert.equal(validateLabels({ products: Array(60).fill(p) }).products.length, 60);
  assert.throws(() => validateLabels({ products: Array(61).fill(p) }), /maximul este 60/);
  const line = { name: "X", unit: "buc", quantity: 1, unit_cost: 1, vat_rate: 21 };
  assert.throws(() => validateNir({ company: "A", supplier: "B", invoice_number: "1", invoice_date: "2026-01-01", lines: Array(41).fill(line) }), /maximul este 40/);
  const ing = { name: "Faina", quantity: 1, unit: "kg" };
  assert.throws(() => validateRecipe({ name: "R", portions: 1, ingredients: Array(41).fill(ing) }), /maximul este 40/);
  const e = { doc: "Z1", description: "Vanzari", receipt: 1 };
  assert.throws(() => validateCashbook({ company: "A", date: "2026-01-01", opening_balance: 0, entries: Array(41).fill(e) }), /maximul este 40/);
});

test("per kind rules", () => {
  assert.throws(() => validateFlyer({ store_name: "M", theme: "neon", products: [{ name: "P", price: 1, unit: "kg" }] }), /Tema/);
  assert.equal(validateFlyer({ store_name: "M", products: [{ name: "P", price: 1, unit: "kg" }] }).theme, "piata");
  assert.throws(() => validateLabels({ products: [{ name: "P", price: 1, unit: "buc", ean: "12345" }] }), /8 sau 13 cifre/);
  assert.equal(validateLabels({ products: [{ name: "P", price: 1, unit: "buc", ean: "5901 2341 2345 7" }] }).products[0].ean, "5901234123457");
  assert.throws(() => validateLabels({ products: [{ name: "P", price: 1, unit: "buc", unit_label: "oz" }] }), /unit_label/);
  assert.throws(() => validateNir({ company: "A", supplier: "B", invoice_number: "1", invoice_date: "2026-01-01", lines: [{ name: "X", unit: "buc", quantity: 1, unit_cost: 1, vat_rate: 7 }] }), /Cota TVA/);
  assert.throws(() => validateCashbook({ company: "A", date: "2026-01-01", opening_balance: 0, entries: [{ doc: "1", description: "x" }] }), /o încasare sau o plată/);
  assert.throws(() => validateRecipe({ name: "R", portions: 0, ingredients: [{ name: "Faina", quantity: 1, unit: "kg" }] }), ValidationError);
  // optional fields stay out of the JSON
  const f = validateFlyer({ store_name: "M", products: [{ name: "P", price: 1, unit: "kg" }] });
  assert.deepEqual(Object.keys(f.products[0]).sort(), ["name", "price", "unit"]);
  assert.equal("phone" in f, false);
});

test("payload max 32 KB", () => {
  // 20 emoji = 40 UTF-16 units (inside the text limit) but 80 bytes of JSON.
  const big = { name: "x".repeat(80), quantity: 1, unit: "kg", allergens: Array(14).fill("🥚".repeat(20)) };
  assert.throws(() => validateRecipe({ name: "R", portions: 1, ingredients: Array(40).fill(big) }), /prea mare/);
  assert.equal(MAX_PAYLOAD_BYTES, 32768);
});

test("mock payloads pass their validators unchanged (idempotent)", () => {
  const v = { flyer: validateFlyer, labels: validateLabels, nir: validateNir, recipe: validateRecipe, cashbook: validateCashbook };
  for (const [kind, d] of Object.entries(MOCK_DRAFTS)) {
    const once = v[kind as keyof typeof v](d.payload);
    assert.deepEqual(v[kind as keyof typeof v](once), once, kind);
    assert.ok(payloadBytes(once) < MAX_PAYLOAD_BYTES);
  }
});

test("NIR VAT: only the rates in force from 1 August 2025 (21% and 11%)", () => {
  assert.deepEqual([...VAT_RATES], [21, 11]);
  const nir = (vat_rate: unknown) =>
    validateNir({ company: "A", supplier: "B", invoice_number: "1", invoice_date: "2026-01-01", lines: [{ name: "X", unit: "buc", quantity: 1, unit_cost: 1, vat_rate }] });
  assert.equal(nir(21).lines[0].vat_rate, 21);
  assert.equal(nir("11").lines[0].vat_rate, 11);
  for (const old of [0, 5, 9, 19, 24]) {
    assert.throws(
      () => nir(old),
      (e: unknown) =>
        e instanceof ValidationError &&
        e.field === "lines[0].vat_rate" &&
        e.message === 'Cota TVA din "lines[0].vat_rate" trebuie să fie 21 sau 11 (cotele în vigoare din 1 august 2025).',
      String(old),
    );
  }
});
