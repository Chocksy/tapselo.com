import type { CompanyInfo } from "./types.ts";
import { MSG_ANAF_UNAVAILABLE, MSG_NOT_FOUND } from "./proxy.ts";
import { isValidCui, normalizeCui } from "./normalize.ts";

export type CuiLookupErrorCode =
  | "invalid"
  | "not_found"
  | "anaf_unavailable"
  | "rate_limit"
  | "network"
  | "bad_response";

export type CuiLookupResult =
  | { ok: true; company: CompanyInfo }
  | { ok: false; code: CuiLookupErrorCode; message: string };

export const CUI_LOOKUP_TIMEOUT_MS = 12_000;

export const CUI_MESSAGES: Record<CuiLookupErrorCode, string> = {
  invalid: "CUI invalid. Verifică cifrele și încearcă din nou (cu sau fără prefix RO).",
  not_found: MSG_NOT_FOUND,
  anaf_unavailable: MSG_ANAF_UNAVAILABLE,
  rate_limit: "Prea multe interogări. Așteaptă o secundă și încearcă din nou.",
  network: "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
  bad_response: MSG_ANAF_UNAVAILABLE,
};

export function checkCui(raw: string): { ok: true; cui: string } | { ok: false; message: string } {
  const cui = normalizeCui(raw);
  if (!cui || !isValidCui(cui)) {
    return { ok: false, message: CUI_MESSAGES.invalid };
  }
  return { ok: true, cui };
}

type ApiErrorBody = { error?: string; code?: string };

function mapApiError(status: number, body: ApiErrorBody | null): CuiLookupResult {
  const code = body?.code;
  if (code === "not_found" || status === 404 && body?.error) {
    return { ok: false, code: "not_found", message: body?.error ?? CUI_MESSAGES.not_found };
  }
  if (code === "anaf_unavailable" || status === 503) {
    return { ok: false, code: "anaf_unavailable", message: body?.error ?? CUI_MESSAGES.anaf_unavailable };
  }
  if (code === "rate_limit" || status === 429) {
    return { ok: false, code: "rate_limit", message: body?.error ?? CUI_MESSAGES.rate_limit };
  }
  if (code === "invalid_cui" || status === 400) {
    return { ok: false, code: "invalid", message: body?.error ?? CUI_MESSAGES.invalid };
  }
  // Static host 404 HTML (no Pages Function) must not read as “CUI not found”.
  if (status === 404 && !body?.code) {
    return { ok: false, code: "anaf_unavailable", message: CUI_MESSAGES.anaf_unavailable };
  }
  return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };
}

async function readApiError(res: Response): Promise<ApiErrorBody | null> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) return null;
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return null;
  }
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

  if (!res.ok) {
    const body = await readApiError(res);
    return mapApiError(res.status, body);
  }

  try {
    const company = (await res.json()) as CompanyInfo;
    if (!company || typeof company.cui !== "string" || !company.name) {
      return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };
    }
    return { ok: true, company };
  } catch {
    return { ok: false, code: "bad_response", message: CUI_MESSAGES.bad_response };
  }
}
