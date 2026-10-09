import type { CompanyInfo } from "./types.ts";
import { isValidCui, normalizeCui } from "./normalize.ts";

export type CuiLookupErrorCode = "invalid" | "not_found" | "rate_limit" | "network" | "bad_response";

export type CuiLookupResult =
  | { ok: true; company: CompanyInfo }
  | { ok: false; code: CuiLookupErrorCode; message: string };

export const CUI_LOOKUP_TIMEOUT_MS = 12_000;

export const CUI_MESSAGES: Record<CuiLookupErrorCode, string> = {
  invalid: "CUI invalid. Verifică cifrele și încearcă din nou (cu sau fără prefix RO).",
  not_found: "ANAF nu are date pentru acest CUI la data interogării.",
  rate_limit: "Prea multe interogări. Așteaptă o secundă și încearcă din nou.",
  network: "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
  bad_response: "Serviciul de verificare nu răspunde acum. Încearcă mai târziu.",
};

export function checkCui(raw: string): { ok: true; cui: string } | { ok: false; message: string } {
  const cui = normalizeCui(raw);
  if (!cui || !isValidCui(cui)) {
    return { ok: false, message: CUI_MESSAGES.invalid };
  }
  return { ok: true, cui };
}

/** Browser lookup via same-origin Pages Function (ANAF has no CORS). */
export async function lookupCuiViaApi(
  raw: string,
  apiBase = "/api",
  fetchFn: typeof fetch = fetch,
): Promise<CuiLookupResult> {
  const checked = checkCui(raw);
  if (!checked.ok) return { ok: false, code: "invalid", message: checked.message };

  const base = apiBase.replace(/\/+$/, "");
  const url = `${base}/anaf/cui/${encodeURIComponent(checked.cui)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CUI_LOOKUP_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchFn(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return { ok: false, code: "network", message: CUI_MESSAGES.network };
  }
  clearTimeout(timer);

  if (res.status === 429) return { ok: false, code: "rate_limit", message: CUI_MESSAGES.rate_limit };
  if (res.status === 404) return { ok: false, code: "not_found", message: CUI_MESSAGES.not_found };
  if (res.status === 400) return { ok: false, code: "invalid", message: CUI_MESSAGES.invalid };
  if (!res.ok) return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };

  try {
    const company = (await res.json()) as CompanyInfo;
    if (!company || typeof company.cui !== "string") {
      return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };
    }
    return { ok: true, company };
  } catch {
    return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };
  }
}
