export type FileKind = "opis" | "day" | "foreign" | "unreadable";

export interface ParsedOpis {
  idM: string;
  nui: string;
  cif: string;
  an?: number;
  luna?: number;
  nrRapI: number;
  nrRapF: number;
  tipAmef: string;
}

export interface ParsedDay {
  idM: string;
  nui: string;
  cif?: string;
  an?: number;
  luna?: number;
  zReport: number;
  idR: string;
}

export interface ClassifiedFile {
  name: string;
  kind: FileKind;
  xml?: string;
  parseError?: string;
  source: "xml" | "p7b" | "zip";
}

export type IssueSeverity = "error" | "warning" | "info";

export interface CheckerIssue {
  severity: IssueSeverity;
  code: string;
  title: string;
  ceInseamna: string;
  ceFaci: string;
  file?: string;
  line?: number;
  field?: string;
}

export interface CrossCheckInput {
  opis: ParsedOpis | null;
  days: { file: string; parsed: ParsedDay }[];
  foreign: string[];
  opisFiles: string[];
}

export interface ErrTxtLine {
  raw: string;
  explained: boolean;
  title?: string;
  ceInseamna?: string;
  ceFaci?: string;
}
