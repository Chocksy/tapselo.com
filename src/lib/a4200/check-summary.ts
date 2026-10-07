import { groupDaysByZ } from "./day-groups.ts";
import type { CrossCheckInput, ParsedOpis } from "./types.ts";

export type ZRowStatus = "present" | "missing" | "duplicate" | "extra";

export interface ZCheckRow {
  z: number;
  status: ZRowStatus;
  file?: string;
}

export interface OpisCheckSummary {
  opis: ParsedOpis;
  opisFile?: string;
  zRangeLabel: string;
  expectedCount: number;
  presentCount: number;
  rows: ZCheckRow[];
  cif: string;
  nui: string;
}

export function formatZ(z: number): string {
  return `Z ${z}`;
}

export function formatZRange(opis: ParsedOpis): string {
  if (opis.nrRapI === opis.nrRapF) return formatZ(opis.nrRapI);
  return `${formatZ(opis.nrRapI)}–${formatZ(opis.nrRapF)}`;
}

export function buildOpisCheckSummary(input: CrossCheckInput): OpisCheckSummary | null {
  const { opis, days, opisFiles } = input;
  if (!opis) return null;

  const grouped = groupDaysByZ(days);

  const rows: ZCheckRow[] = [];
  for (let z = opis.nrRapI; z <= opis.nrRapF; z++) {
    const file = grouped.labelByZ.get(z);
    if (!file) {
      rows.push({ z, status: "missing" });
    } else if (grouped.duplicateZ.some((d) => d.z === z)) {
      rows.push({ z, status: "duplicate", file });
    } else {
      rows.push({ z, status: "present", file });
    }
  }

  for (const d of days) {
    if (d.parsed.zReport < opis.nrRapI || d.parsed.zReport > opis.nrRapF) {
      rows.push({ z: d.parsed.zReport, status: "extra", file: d.file });
    }
  }

  rows.sort((a, b) => a.z - b.z);

  const presentCount = grouped.uniqueZ.size;

  return {
    opis,
    opisFile: opisFiles[0],
    zRangeLabel: formatZRange(opis),
    expectedCount: opis.nrRapF - opis.nrRapI + 1,
    presentCount,
    rows,
    cif: opis.cif,
    nui: opis.nui,
  };
}
