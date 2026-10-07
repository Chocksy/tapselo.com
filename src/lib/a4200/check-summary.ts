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
  return `Z${z}`;
}

export function formatZRange(opis: ParsedOpis): string {
  return `${formatZ(opis.nrRapI)}–${formatZ(opis.nrRapF)}`;
}

export function buildOpisCheckSummary(input: CrossCheckInput): OpisCheckSummary | null {
  const { opis, days, opisFiles } = input;
  if (!opis) return null;

  const zSeen = new Map<number, string>();
  for (const d of days) {
    const prev = zSeen.get(d.parsed.zReport);
    if (prev) zSeen.set(d.parsed.zReport, `${prev}, ${d.file}`);
    else zSeen.set(d.parsed.zReport, d.file);
  }

  const rows: ZCheckRow[] = [];
  for (let z = opis.nrRapI; z <= opis.nrRapF; z++) {
    const file = zSeen.get(z);
    if (!file) {
      rows.push({ z, status: "missing" });
    } else if (file.includes(",")) {
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

  const presentCount = rows.filter((r) => r.status === "present").length;

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
