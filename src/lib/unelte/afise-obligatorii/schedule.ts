import type { DayHours, WeekSchedule } from "./types.ts";

const DAY_LABELS: { key: keyof WeekSchedule; label: string }[] = [
  { key: "mon", label: "Luni" },
  { key: "tue", label: "Marți" },
  { key: "wed", label: "Miercuri" },
  { key: "thu", label: "Joi" },
  { key: "fri", label: "Vineri" },
  { key: "sat", label: "Sâmbătă" },
  { key: "sun", label: "Duminică" },
];

function fmtHours(h: DayHours): string {
  return `${h.open}–${h.close}`;
}

/** Human-readable program lines for the operating-hours sign. */
export function formatScheduleLines(schedule: WeekSchedule): string[] {
  const lines: string[] = [];
  for (const { key, label } of DAY_LABELS) {
    const hours = schedule[key];
    if (hours && typeof hours === "object" && "open" in hours) {
      lines.push(`${label}: ${fmtHours(hours)}`);
    } else if (hours === null) {
      lines.push(`${label}: închis`);
    }
  }
  const breakLabel = schedule.breakLabel.trim();
  if (breakLabel) lines.push(`Pauză: ${breakLabel}`);
  const closed = schedule.closedNotes.trim();
  if (closed) lines.push(closed);
  return lines;
}

/** Merge shop name into multiple signs when present. */
export function shopHeaderLines(shop: { businessName: string; address: string; cui: string }): string[] {
  const lines: string[] = [];
  const name = shop.businessName.trim();
  const addr = shop.address.trim();
  const cui = shop.cui.trim();
  if (name) lines.push(name);
  if (addr) lines.push(addr);
  if (cui) lines.push(`CUI: ${cui}`);
  return lines;
}
