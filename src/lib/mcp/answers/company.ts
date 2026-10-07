// check_company: public company data from ANAF (PlatitorTvaRest v9) by CUI.
// Live shape checked 2026-10-01: { found: [{ date_generale, inregistrare_scop_Tva, inregistrare_RTVAI,
// stare_inactiv, inregistrare_SplitTVA, adresa_sediu_social, adresa_domiciliu_fiscal }], notFound: [cui] }.

import type { ToolDef, ToolEnv } from "../types.ts";
import { formatDateRo, todayBucharest } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { isValidCuiCheckDigit } from "../../fiscal/check-digit.ts";
import { readOnly } from "./kb.ts";

const NAME = "check_company";
export const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
export const ANAF_PUBLIC_URL = "https://www.anaf.ro/RegistruTVA/";
const TIMEOUT_MS = 8000;

/** "RO 14399840" -> "14399840"; null when it is not a plausible CUI. */
export function normalizeCui(raw: unknown): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/\s+/g, "").replace(/^RO/, "");
  return /^[1-9]\d{1,9}$/.test(s) ? s : null;
}

/** CUI control digit (key 753217532). */
export function isValidCui(cui: string): boolean {
  return isValidCuiCheckDigit(cui);
}

export interface CompanyInfo {
  cui: string;
  name: string;
  address: string;
  registration_number: string | null;
  caen: string | null;
  status: string | null;
  vat_payer: boolean;
  vat_on_cash: boolean;
  split_vat: boolean;
  inactive: boolean;
  deregistered_on: string | null;
  efactura_registry: boolean;
  efactura_since: string | null;
  date: string;
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Parses the ANAF response text. Returns null for "not found", throws on a bad shape. */
export function parseAnafResponse(text: string, cui: string): CompanyInfo | null {
  // ANAF sometimes leaves raw control characters inside strings; JSON.parse rejects them.
  const data = o(JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")));
  if (!Array.isArray(data.found)) throw new Error("unexpected ANAF shape");
  const row = (data.found as unknown[]).map(o).find((r) => String(o(r.date_generale).cui) === cui) ?? null;
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

const yn = (b: boolean) => (b ? "da" : "nu");

export function companyMd(c: CompanyInfo, url: string): string {
  return [
    `**${c.name}** (CUI ${c.cui})`,
    "",
    `- Adresa: ${c.address || "-"}`,
    `- Nr. Registrul Comertului: ${c.registration_number ?? "-"}`,
    `- Cod CAEN: ${c.caen ?? "-"}`,
    c.status ? `- Stare: ${c.status}` : null,
    `- Platitor de TVA: ${yn(c.vat_payer)}`,
    `- TVA la incasare: ${yn(c.vat_on_cash)}`,
    `- Split TVA: ${yn(c.split_vat)}`,
    `- Inactiv fiscal: ${yn(c.inactive)}`,
    c.deregistered_on ? `- Radiata la: ${formatDateRo(c.deregistered_on)}` : null,
    `- In Registrul RO e-Factura: ${yn(c.efactura_registry)}${c.efactura_since ? ` (din ${formatDateRo(c.efactura_since)})` : ""}`,
    "",
    `Date ANAF la ${formatDateRo(c.date)}. Sursa: ${ANAF_PUBLIC_URL}`,
    `Facturi, NIR si casa de marcat pentru magazinul tau: ${url}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export async function checkCompany(cuiRaw: unknown, env: Pick<ToolEnv, "fetch">, today = todayBucharest()) {
  const url = trackedUrl("/", NAME);
  const cui = normalizeCui(cuiRaw);
  if (!cui || !isValidCui(cui)) {
    return {
      text: `CUI-ul "${String(cuiRaw ?? "").slice(0, 20)}" nu este valid (cifra de control nu se potriveste). Verifica cifrele.`,
      structured: { cui: cui ?? null, valid: false },
      isError: true,
    };
  }
  const fail = {
    text: `Serviciul ANAF nu raspunde acum. Incearca din nou peste cateva minute sau verifica direct pe ${ANAF_PUBLIC_URL}`,
    structured: { cui, anaf_url: ANAF_PUBLIC_URL },
    isError: true,
  };
  let res: Response;
  try {
    res = await env.fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{ cui: Number(cui), data: today }]),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return fail;
  }
  if (!res.ok) return fail;
  let info: CompanyInfo | null;
  try {
    info = parseAnafResponse(await res.text(), cui);
  } catch {
    return fail;
  }
  if (!info) {
    return {
      text: `ANAF nu are date pentru CUI ${cui}. Verifica numarul sau cauta pe ${ANAF_PUBLIC_URL}`,
      structured: { cui, found: false, anaf_url: ANAF_PUBLIC_URL },
    };
  }
  return { text: companyMd(info, url), structured: { found: true, ...info, url } };
}

export function createCheckCompanyTool(): ToolDef {
  return {
    name: NAME,
    title: "Verifica firma dupa CUI (ANAF)",
    description:
      "Look up a Romanian company by CUI / CIF / cod fiscal in the public ANAF registry (verifica firma, " +
      "platitor de TVA, TVA la incasare, split TVA, firma inactiva / radiata, Registrul RO e-Factura, cod CAEN, " +
      "adresa, nr. Registrul Comertului). Live data from ANAF for today.",
    inputSchema: {
      type: "object",
      properties: {
        cui: {
          type: ["string", "integer"],
          minLength: 2,
          maxLength: 14,
          minimum: 10,
          maximum: 9999999999,
          pattern: "^\\s*(RO|ro)?\\s*[0-9]{2,10}\\s*$",
          description: "CUI cu sau fara RO, de ex. \"RO14399840\" sau \"14399840\"",
        },
      },
      required: ["cui"],
      additionalProperties: false,
    },
    annotations: readOnly(true),
    handler: (args, env) => checkCompany(args.cui, env),
  };
}
