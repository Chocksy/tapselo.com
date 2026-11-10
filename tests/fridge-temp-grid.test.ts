import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFridgeCleaningLog } from "../src/lib/generators/fridge-temp-log.ts";
import { mergeGridSnapshots, preserveAllGridsOnResize, trimSnapshotToDays } from "../src/lib/unelte/fridge-temp-grid.ts";

const row = (temp: string) => ({
  morning_temp: temp,
  morning_initials: "AB",
  evening_temp: "",
  evening_initials: "",
  notes: "",
});

test("luna 31 → februarie → 31: citirea zilei 30 rămâne în stare", () => {
  let stored = new Map<number, ReturnType<typeof row>>();
  stored = mergeGridSnapshots(stored, new Map([[30, row("4,5")]]));
  assert.equal(stored.get(30)?.morning_temp, "4,5");

  // februarie: grile vizibile doar 1–28; nu pierdem zilele ascunse
  stored = mergeGridSnapshots(stored, new Map([[1, row("3")]]));
  assert.equal(stored.get(30)?.morning_temp, "4,5");
  assert.equal(trimSnapshotToDays(stored, 28).has(30), false);
  assert.equal(trimSnapshotToDays(stored, 28).get(1)?.morning_temp, "3");

  // înapoi la lună de 31: citirea zilei 30 e încă în stare
  assert.equal(stored.get(30)?.morning_temp, "4,5");
});

test("rebuildAllGrids: fiecare aparat își păstrează citirile (fără amestec între grile)", () => {
  const gridA = new Map([[1, row("3,1")], [30, row("5")]]);
  const gridB = new Map([[1, row("−18")]]);
  const [a, b] = preserveAllGridsOnResize([gridA, gridB]);
  assert.equal(a.get(1)?.morning_temp, "3,1");
  assert.equal(a.get(30)?.morning_temp, "5");
  assert.equal(b.get(1)?.morning_temp, "−18");
});

test("curățenie: zone goale nu imprimă exemple implicite", () => {
  const html = renderFridgeCleaningLog(
    { company: "X", month: 11, year: 2026, zones: [], rows: [] },
    { kind: "local", payload: null, expires_at: null },
    { local: true },
  );
  assert.doesNotMatch(html, /Vitrină/);
  assert.doesNotMatch(html, /WC personal/);
});
