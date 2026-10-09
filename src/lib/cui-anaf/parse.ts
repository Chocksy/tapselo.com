import type { CompanyInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Parses ANAF PlatitorTvaRest v9 JSON text. Returns null when the CUI is in notFound / missing. */
export function parseAnafResponse(text: string, cui: string): CompanyInfo | null {
  const data = o(JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")));
  if (!Array.isArray(data.found)) throw new Error("unexpected ANAF shape");
  const row =
    (data.found as unknown[]).map(o).find((r) => String(o(r.date_generale).cui) === cui) ?? null;
  if (!row) return null;
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
