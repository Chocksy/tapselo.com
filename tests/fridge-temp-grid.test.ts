import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFridgeCleaningLog } from "../src/lib/generators/fridge-temp-log.ts";
import { preserveAllGridsOnResize, trimSnapshotToDays } from "../src/lib/unelte/fridge-temp-grid.ts";

const row = (temp: string) => ({
  morning_temp: temp,
  morning_initials: "AB",
  evening_temp: "",
  evening_initials: "",
  notes: "",
});

test("trimSnapshotToDays păstrează citirile la redimensionarea grilei", () => {
  const snap = new Map([
    [1, { morning_temp: "3", morning_initials: "AB", evening_temp: "4", evening_initials: "CD", notes: "ok" }],
    [31, { morning_temp: "2", morning_initials: "", evening_temp: "", evening_initials: "", notes: "" }],
  ]);
  const feb = trimSnapshotToDays(snap, 28);
  assert.equal(feb.size, 1);
  assert.equal(feb.get(1)?.morning_temp, "3");
  assert.equal(feb.has(31), false);

  const back = trimSnapshotToDays(snap, 31);
  assert.equal(back.get(31)?.morning_temp, "2");
});

test("rebuildAllGrids: fiecare aparat își păstrează citirile (fără amestec între grile)", () => {
  const gridA = new Map([[1, row("3,1")]]);
  const gridB = new Map([[1, row("−18")]]);
  const [a, b] = preserveAllGridsOnResize([gridA, gridB], 31);
  assert.equal(a.get(1)?.morning_temp, "3,1");
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
