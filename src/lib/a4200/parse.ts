import { IDM_DAY_LEN, NUI_LEN, Z_SUFFIX_LEN } from "./constants.ts";
import type { FileKind, ParsedDay, ParsedOpis } from "./types.ts";

const Z_FILENAME_RE = /_Z(\d{1,4})\b/i;

export function nuiFromId(id: string): string {
  return id.slice(0, NUI_LEN);
}

/** Z report number from idM / idR (last 4 digits of the 28-char identifier). */
export function zFromAmefId(id: string): number | null {
  if (id.length < NUI_LEN + 14 + Z_SUFFIX_LEN) return null;
  const raw = id.slice(24, 28);
  if (!/^\d{4}$/.test(raw)) return null;
  return parseInt(raw, 10);
}

export function zFromFileName(name: string): number | null {
  const m = name.match(Z_FILENAME_RE);
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function resolveZReport(idM: string, idR: string, fileName: string): number | null {
  return zFromAmefId(idM) ?? zFromAmefId(idR) ?? zFromFileName(fileName);
}

function parseAttributes(fragment: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /\s([A-Za-z_][\w.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) attrs.set(m[1], m[2]);
  return attrs;
}

function firstOpenTag(xml: string, localName: string): Map<string, string> | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}\\b([^>/]*)`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return parseAttributes(m[1]);
}

function requireAttr(attrs: Map<string, string>, name: string, ctx: string): string {
  const v = attrs.get(name);
  if (v === undefined || v === "") throw new Error(`${ctx}: lipsește atributul ${name}.`);
  return v;
}

function optionalInt(attrs: Map<string, string>, name: string): number | undefined {
  const v = attrs.get(name);
  if (v === undefined || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function classifyXml(xml: string): FileKind {
  const t = xml.trim();
  if (/<(?:[\w.-]+:)?mReg[\s>/]/.test(t)) return "opis";
  if (/<(?:[\w.-]+:)?msj[\s>/]/.test(t)) return "day";
  return "foreign";
}

export function parseOpisXml(xml: string): ParsedOpis {
  const attrs = firstOpenTag(xml, "mReg");
  if (!attrs) throw new Error("Rădăcina nu este opisul (mReg).");

  const idM = requireAttr(attrs, "idM", "Opis");
  const cif = requireAttr(attrs, "cif", "Opis");
  const tipAmef = requireAttr(attrs, "tip_amef", "Opis");
  const nrRapI = optionalInt(attrs, "nrRapI");
  const nrRapF = optionalInt(attrs, "nrRapF");
  if (nrRapI === undefined || nrRapF === undefined) {
    throw new Error("Opis incomplet: nrRapI și nrRapF sunt obligatorii.");
  }

  return {
    idM,
    nui: nuiFromId(idM),
    cif,
    an: optionalInt(attrs, "an"),
    luna: optionalInt(attrs, "luna"),
    nrRapI,
    nrRapF,
    tipAmef,
  };
}

export function parseDayXml(xml: string, fileName = ""): ParsedDay {
  const attrs = firstOpenTag(xml, "msj");
  if (!attrs) throw new Error("Rădăcina nu este zi fiscală (msj).");

  const idM = requireAttr(attrs, "idM", "Zi fiscală");
  if (idM.length !== IDM_DAY_LEN) {
    throw new Error(`idM trebuie să aibă ${IDM_DAY_LEN} caractere pe zi fiscală (are ${idM.length}).`);
  }

  const rBAttrs = firstOpenTag(xml, "rB");
  const idR = rBAttrs ? requireAttr(rBAttrs, "idR", "Raport Z") : idM;

  const zReport = resolveZReport(idM, idR, fileName);
  if (zReport === null) {
    throw new Error("Nu am putut citi numărul raportului Z din idM/idR sau nume fișier.");
  }

  return {
    idM,
    nui: nuiFromId(idM),
    cif: attrs.get("cif"),
    an: optionalInt(attrs, "an"),
    luna: optionalInt(attrs, "luna"),
    zReport,
    idR,
  };
}

/** Period hint from idM timestamp (YYYYLLZZ in positions 10–17). */
export function periodFromIdM(idM: string): { an: number; luna: number } | null {
  if (idM.length < 18) return null;
  const y = Number.parseInt(idM.slice(10, 14), 10);
  const m = Number.parseInt(idM.slice(14, 16), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { an: y, luna: m };
}
