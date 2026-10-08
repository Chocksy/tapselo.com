import { test } from "node:test";
import assert from "node:assert/strict";
import { nirLine, nirTotals } from "../src/lib/generators/nir.ts";
import { unitPrice } from "../src/lib/generators/labels.ts";
import { recipeCalc, ingredientAllergens, allergensInText, ALLERGENS } from "../src/lib/generators/recipe.ts";
import { cashbookCalc, CASH_LIMIT } from "../src/lib/generators/cashbook.ts";
import { warehouseCardCalc } from "../src/lib/generators/warehouse-card.ts";
import { fmtMoney, fmtQty } from "../src/lib/generators/page.ts";

test("NIR line: cost, VAT, markup, sale price, non-chargeable VAT", () => {
  // 12.5 kg x 24.80 = 310.00; VAT 11% = 34.10; sale = 24.80 * 1.25 * 1.11 = 34.41
  const c = nirLine({ name: "Telemea", unit: "kg", quantity: 12.5, unit_cost: 24.8, vat_rate: 11 }, 25);
  assert.equal(c.cost_value, 310);
  assert.equal(c.cost_vat, 34.1);
  assert.equal(c.cost_total, 344.1);
  assert.equal(c.sale_price, 34.41);
  assert.equal(c.sale_value, 430.13); // 12.5 * 34.41 = 430.125 -> half away from zero
  assert.equal(c.sale_vat, 42.63); // 430.13 - 387.50
  assert.equal(c.markup_value, 77.5); // 387.50 - 310.00
  assert.equal(c.markup_percent, 25);

  // given sale price wins over the markup
  const g = nirLine({ name: "Detergent", unit: "buc", quantity: 6, unit_cost: 7.1, vat_rate: 21, sale_price: 12.99 }, 25);
  assert.equal(g.sale_price, 12.99);
  assert.equal(g.sale_value, 77.94);
  assert.equal(g.cost_value, 42.6);
  assert.equal(g.cost_vat, 8.95); // 8.946
  // no sale price, no markup
  const n = nirLine({ name: "X", unit: "buc", quantity: 2, unit_cost: 3, vat_rate: 21 });
  assert.equal(n.sale_price, null);
  assert.equal(n.sale_value, null);
});

test("NIR totals and VAT groups", () => {
  const t = nirTotals({
    markup_percent: 25,
    lines: [
      { name: "Telemea", unit: "kg", quantity: 12.5, unit_cost: 24.8, vat_rate: 11 },
      { name: "Lapte", unit: "buc", quantity: 24, unit_cost: 5.4, vat_rate: 11 },
      { name: "Detergent", unit: "buc", quantity: 6, unit_cost: 7.1, vat_rate: 21, sale_price: 12.99 },
    ],
  });
  assert.equal(t.cost_value, 482.2); // 310 + 129.6 + 42.6
  assert.equal(t.cost_vat, 57.31); // 34.10 + 14.26 + 8.95
  assert.equal(t.cost_total, 539.51);
  assert.deepEqual(t.vat_groups, [
    { rate: 11, base: 439.6, vat: 48.36, total: 487.96 },
    { rate: 21, base: 42.6, vat: 8.95, total: 51.55 },
  ]);
  // lapte: 5.40 * 1.25 * 1.11 = 7.4925 -> 7.49; x24 = 179.76
  assert.equal(t.sale_value, 687.83); // 430.13 + 179.76 + 77.94
  assert.equal(t.complete_sale, true);
  assert.equal(nirTotals({ lines: [{ name: "X", unit: "buc", quantity: 1, unit_cost: 1, vat_rate: 0 }] }).complete_sale, false);
});

test("unit price per kg / l / buc", () => {
  assert.deepEqual(unitPrice({ price: 22, unit: "buc", unit_quantity: 250, unit_label: "g" }), { value: 88, per: "kg" });
  assert.deepEqual(unitPrice({ price: 11.99, unit: "buc", unit_quantity: 1, unit_label: "l" }), { value: 11.99, per: "l" });
  assert.deepEqual(unitPrice({ price: 3.49, unit: "buc", unit_quantity: 330, unit_label: "ml" }), { value: 10.58, per: "l" });
  assert.deepEqual(unitPrice({ price: 4.5, unit: "buc", unit_quantity: 75, unit_label: "cl" }), { value: 6, per: "l" });
  assert.deepEqual(unitPrice({ price: 9.5, unit: "buc", unit_quantity: 10, unit_label: "buc" }), { value: 0.95, per: "buc" });
  assert.deepEqual(unitPrice({ price: 32, unit: "kg" }), { value: 32, per: "kg" });
  assert.equal(unitPrice({ price: 4.2, unit: "buc" }), null);
});

test("recipe cost per portion and allergens", () => {
  const c = recipeCalc({
    name: "Placinta",
    portions: 8,
    ingredients: [
      { name: "Faina alba 000", quantity: 0.5, unit: "kg", cost_per_unit: 4.2 },
      { name: "Branza de vaci", quantity: 0.4, unit: "kg", cost_per_unit: 18 },
      { name: "Oua", quantity: 3, unit: "buc", cost_per_unit: 0.9 },
      { name: "Seminte", quantity: 0.01, unit: "kg", allergens: ["susan", "ceva necunoscut"] },
    ],
  });
  assert.equal(c.total_cost, 12); // 2.10 + 7.20 + 2.70
  assert.equal(c.cost_per_portion, 1.5);
  assert.equal(c.complete_cost, false);
  assert.deepEqual(c.allergens, ["gluten", "oua", "lapte", "susan"]);
  assert.deepEqual(c.other_allergens, ["ceva necunoscut"]);

  assert.equal(ALLERGENS.length, 14);
  const cases: [string, string[]][] = [
    ["Faina de grau", ["gluten"]],
    ["Unt 82%", ["lapte"]],
    ["Smantana 20%", ["lapte"]],
    ["Branzeturi asortate", ["lapte"]],
    ["Nuci decojite", ["fructe_coaja"]],
    ["Alune de padure", ["fructe_coaja"]],
    ["Migdale", ["fructe_coaja"]],
    ["Seminte de susan", ["susan"]],
    ["Mustar dulce", ["mustar"]],
    ["Telina radacina", ["telina"]],
    ["Sos de soia", ["soia"]],
    ["File de somon", ["peste"]],
    ["Creveti", ["crustacee"]],
    ["Midii", ["moluste"]],
    ["Faina de lupin", ["gluten", "lupin"]],
    ["Vin alb sec", ["sulfiti"]],
    ["Arahide prajite", ["arahide"]],
    ["Ouă de găină", ["oua"]],
    ["Vinete", []],
    ["Casa", []],
    ["Zahar", []],
  ];
  for (const [name, ids] of cases) assert.deepEqual(allergensInText(name), ids, name);
  assert.deepEqual(ingredientAllergens({ name: "Mix", allergens: ["Gluten", "lapte"] }).ids, ["gluten", "lapte"]);
});

test("cash book running balance and the 50,000 lei warning", () => {
  const c = cashbookCalc({
    opening_balance: 1250.4,
    entries: [
      { doc: "Z", description: "Vanzari", receipt: 4820.15 },
      { doc: "DP1", description: "Furnizor", payment: 1120 },
      { doc: "DP2", description: "Banca", payment: 3000 },
    ],
  });
  assert.deepEqual(c.balances, [6070.55, 4950.55, 1950.55]);
  assert.equal(c.total_receipts, 4820.15);
  assert.equal(c.total_payments, 4120);
  assert.equal(c.closing_balance, 1950.55);
  assert.equal(c.over_limit, false);
  assert.deepEqual(c.warnings, []);

  const over = cashbookCalc({ opening_balance: 49_000, entries: [{ doc: "Z", description: "x", receipt: 1000.01 }] });
  assert.equal(CASH_LIMIT, 50_000);
  assert.equal(over.closing_balance, 50_000.01);
  assert.equal(over.over_limit, true);
  assert.match(over.warnings[0], /depășește plafonul de casă de 50\.000,00 lei/);
  assert.equal(cashbookCalc({ opening_balance: 49_000, entries: [{ doc: "Z", description: "x", receipt: 1000 }] }).over_limit, false);

  const neg = cashbookCalc({ opening_balance: 10, entries: [{ doc: "P", description: "x", payment: 20 }, { doc: "Z", description: "x", receipt: 50 }] });
  assert.deepEqual(neg.balances, [-10, 40]);
  assert.equal(neg.negative_at, 0);
  assert.match(neg.warnings[0], /negativ după înregistrarea 1\. Casa nu poate avea sold negativ/);

  // float noise does not leak: 0.1 + 0.2
  assert.equal(cashbookCalc({ opening_balance: 0.1, entries: [{ doc: "Z", description: "x", receipt: 0.2 }] }).closing_balance, 0.3);
});

test("warehouse card: running stock from opening, entries and exits", () => {
  const c = warehouseCardCalc({
    opening_stock: 10,
    rows: [
      { date: "2026-10-01", doc_number: "NIR 1", doc_type: "NIR", entries_in: 5 },
      { date: "2026-10-02", doc_number: "BC 2", doc_type: "Bon consum", entries_out: 3 },
      { date: "2026-10-03", doc_number: "AV 1", doc_type: "Aviz", entries_out: 2 },
    ],
  });
  assert.deepEqual(c.rows.map((r) => r.stock), [15, 12, 10]);
  assert.equal(c.closing_stock, 10);
});

test("Romanian number format", () => {
  assert.equal(fmtMoney(1234.5), "1.234,50");
  assert.equal(fmtMoney(1000000), "1.000.000,00");
  assert.equal(fmtMoney(-10), "-10,00");
  assert.equal(fmtMoney(0.004), "0,00");
  assert.equal(fmtQty(12.5), "12,5");
  assert.equal(fmtQty(2), "2");
  assert.equal(fmtQty(1234.125), "1.234,125");
});
