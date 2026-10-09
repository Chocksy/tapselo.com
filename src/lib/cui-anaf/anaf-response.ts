import type { CompanyInfo } from "./types.ts";

export type AnafErrorCode = "not_found" | "anaf_unavailable";

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function sanitizeAnafJsonText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
}

/** ANAF misconfiguration or HTML error pages (e.g. wrong path) are not “CUI not found”. */
export function looksLikeHtmlResponse(text: string): boolean {
  const t = text.trimStart().slice(0, 64).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}

export function cuiEquals(a: unknown, b: string): boolean {
  const left = String(a ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const right = b.replace(/\D/g, "").replace(/^0+/, "");
  return left.length > 0 && left === right;
}

export function parseAnafPayload(text: string): Obj {
  const data = o(JSON.parse(sanitizeAnafJsonText(text)));
  if (!Array.isArray(data.found)) throw new Error("unexpected ANAF shape");
  return data;
}

export function pickFoundRow(data: Obj, cui: string): Obj | null {
  const found = (data.found as unknown[]).map(o);
  if (!found.length) return null;
  return found.find((r) => cuiEquals(o(r.date_generale).cui, cui)) ?? null;
}

export function isCuiListedNotFound(data: Obj, cui: string): boolean {
  if (!Array.isArray(data.notFound)) return false;
  return (data.notFound as unknown[]).some((n) => cuiEquals(n, cui));
}

export function mapFoundRowToCompany(row: Obj, cui: string): CompanyInfo {
  const g = o(row.date_generale);
  const inactive = o(row.stare_inactiv);
  return {
    cui,
    name: str(g.denumire) ?? "",
    address: str(g.adresa) ?? "",
    registration_number: str(g.nrRegCom),
    caen: str(g.cod_CAEN),
    status: str(g.stare_inregistrare),
    vat_payer: o(row.inregistrare_scop_Tva).scpTVA === true,
    vat_on_cash: o(row.inregistrare_RTVAI).statusTvaIncasare === true,
    split_vat: o(row.inregistrare_SplitTVA).statusSplitTVA === true,
    inactive: inactive.statusInactivi === true,
    deregistered_on: str(inactive.dataRadiere),
    efactura_registry: g.statusRO_e_Factura === true,
    efactura_since: str(g.data_inreg_Reg_RO_e_Factura),
    date: str(g.data) ?? "",
  };
}

export type ParseAnafOutcome =
  | { kind: "ok"; company: CompanyInfo }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export function interpretAnafResponseText(text: string, cui: string): ParseAnafOutcome {
  if (looksLikeHtmlResponse(text)) return { kind: "unavailable" };
  let data: Obj;
  try {
    data = parseAnafPayload(text);
  } catch {
    return { kind: "unavailable" };
  }
  const row = pickFoundRow(data, cui);
  if (row) return { kind: "ok", company: mapFoundRowToCompany(row, cui) };
  if (isCuiListedNotFound(data, cui)) return { kind: "not_found" };
  if ((data.found as unknown[]).length === 0) return { kind: "not_found" };
  return { kind: "unavailable" };
}
