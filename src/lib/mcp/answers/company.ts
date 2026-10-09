// check_company: public company data from ANAF (PlatitorTvaRest v9) by CUI.
// Live shape checked 2026-10-01: { found: [{ date_generale, inregistrare_scop_Tva, inregistrare_RTVAI,
// stare_inactiv, inregistrare_SplitTVA, adresa_sediu_social, adresa_domiciliu_fiscal }], notFound: [cui] }.

import type { ToolDef, ToolEnv } from "../types.ts";
import { formatDateRo, todayBucharest } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";
import { ANAF_PUBLIC_REGISTRY_URL, ANAF_TVA_URL } from "../../cui-anaf/constants.ts";
import { efacturaRegistryValue } from "../../cui-anaf/labels.ts";
import { isValidCui, normalizeCui } from "../../cui-anaf/normalize.ts";
import { parseAnafResponse } from "../../cui-anaf/parse.ts";
import type { CompanyInfo } from "../../cui-anaf/types.ts";

const NAME = "check_company";
export const ANAF_URL = ANAF_TVA_URL;
export const ANAF_PUBLIC_URL = ANAF_PUBLIC_REGISTRY_URL;
const TIMEOUT_MS = 8000;

export { normalizeCui, isValidCui, parseAnafResponse };
export type { CompanyInfo };

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
    `- Registrul RO e-Factura: ${efacturaRegistryValue(c.efactura_registry, c.efactura_since ? formatDateRo(c.efactura_since) : null)}`,
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
