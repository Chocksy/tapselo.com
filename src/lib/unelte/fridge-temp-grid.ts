/** Snapshot/restore day rows in the frigider temperature tool grids (browser DOM helpers + pure merge). */

export type GridRowSnapshot = {
  morning_temp: string;
  morning_initials: string;
  evening_temp: string;
  evening_initials: string;
  notes: string;
};

const FIELD_MAP: Record<string, keyof GridRowSnapshot> = {
  "m-temp": "morning_temp",
  "m-ini": "morning_initials",
  "e-temp": "evening_temp",
  "e-ini": "evening_initials",
  notes: "notes",
};

export function snapshotGridByDay(tbody: HTMLElement | null): Map<number, GridRowSnapshot> {
  const map = new Map<number, GridRowSnapshot>();
  if (!tbody) return map;
  for (const tr of tbody.querySelectorAll("tr[data-day]")) {
    const day = Number((tr as HTMLElement).dataset.day);
    if (!Number.isFinite(day)) continue;
    const row: GridRowSnapshot = {
      morning_temp: "",
      morning_initials: "",
      evening_temp: "",
      evening_initials: "",
      notes: "",
    };
    for (const [attr, key] of Object.entries(FIELD_MAP)) {
      const el = tr.querySelector(`[data-f="${attr}"]`) as HTMLInputElement | null;
      row[key] = el?.value ?? "";
    }
    map.set(day, row);
  }
  return map;
}

/** Keep readings for day numbers that still exist after month length changes (e.g. PDF payload). */
export function trimSnapshotToDays(snap: Map<number, GridRowSnapshot>, daysInMonth: number): Map<number, GridRowSnapshot> {
  const out = new Map<number, GridRowSnapshot>();
  for (const [day, row] of snap) {
    if (day >= 1 && day <= daysInMonth) out.set(day, row);
  }
  return out;
}

/** DOM values override stored; days beyond the visible month stay in the map. */
export function mergeGridSnapshots(
  stored: Map<number, GridRowSnapshot>,
  fromDom: Map<number, GridRowSnapshot>,
): Map<number, GridRowSnapshot> {
  const out = new Map(stored);
  for (const [day, row] of fromDom) {
    out.set(day, { ...row });
  }
  return out;
}

/** One snapshot map per appliance grid — full day map kept across month length changes. */
export function preserveAllGridsOnResize(grids: Map<number, GridRowSnapshot>[]): Map<number, GridRowSnapshot>[] {
  return grids.map((g) => new Map(g));
}

export function applySnapshotToGrid(tbody: HTMLElement | null, snap: Map<number, GridRowSnapshot>): void {
  if (!tbody) return;
  for (const tr of tbody.querySelectorAll("tr[data-day]")) {
    const day = Number((tr as HTMLElement).dataset.day);
    const row = snap.get(day);
    if (!row) continue;
    for (const [attr, key] of Object.entries(FIELD_MAP)) {
      const el = tr.querySelector(`[data-f="${attr}"]`) as HTMLInputElement | null;
      if (el) el.value = row[key];
    }
  }
}
