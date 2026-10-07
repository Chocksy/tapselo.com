// Client-side lookup against Tapselo admin public API (tapselo-pos).
// GET {PUBLIC_BARCODE_API_URL}/barcodes/:ean -> { ean, name, brand?, category?, vat_rate }
// Only these fields are read; anything else in the response (prices, shop data) is dropped.

import { isValidEan } from "../ean13.ts";
import { escapeHtml } from "../generators/page.ts";
import { isVatRateRo, type VatRateRo } from "./vat.ts";

export interface BarcodeProduct {
  ean: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  vat_rate: VatRateRo;
}

export type BarcodeLookupErrorCode = "invalid" | "not_found" | "rate_limit" | "network" | "bad_response";

export type BarcodeLookupResult =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; code: BarcodeLookupErrorCode; message: string };

export const LOOKUP_TIMEOUT_MS = 8000;

export const MESSAGES: Record<BarcodeLookupErrorCode, string> = {
  invalid: "Codul de bare nu pare corect. Verifică dacă are 8 sau 13 cifre.",
  not_found: "Nu am găsit produsul în baza de date Tapselo. Verifică codul sau caută cota TVA pe factura furnizorului.",
  rate_limit: "Prea multe căutări într-un interval scurt. Așteaptă un minut și încearcă din nou.",
  network: "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
  bad_response: "Serviciul de căutare nu răspunde acum. Încearcă mai târziu.",
};

/** Strips spaces and dashes; a 12-digit UPC-A becomes its EAN-13 form (leading 0). Null when not a valid EAN-8/13. */
export function normalizeEan(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  const ean = /^\d{12}$/.test(digits) ? `0${digits}` : digits;
  return isValidEan(ean) ? ean : null;
}

export function barcodeEndpoint(baseUrl: string, ean: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/barcodes/${encodeURIComponent(ean)}`;
}

function parseProduct(body: unknown): BarcodeProduct | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const ean = typeof o.ean === "string" ? o.ean : null;
  const name = typeof o.name === "string" ? o.name.trim() : null;
  if (!ean || !name || !isVatRateRo(o.vat_rate)) return null;
  const brand = typeof o.brand === "string" ? o.brand.trim() || null : null;
  const category = typeof o.category === "string" ? o.category.trim() || null : null;
  return { ean, name, brand, category, vat_rate: o.vat_rate };
}

const fail = (code: BarcodeLookupErrorCode): BarcodeLookupResult => ({ ok: false, code, message: MESSAGES[code] });

export async function lookupBarcode(
  baseUrl: string,
  ean: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = LOOKUP_TIMEOUT_MS,
): Promise<BarcodeLookupResult> {
  let res: Response;
  try {
    res = await fetchFn(barcodeEndpoint(baseUrl, ean), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return fail("network");
  }
  if (res.status === 404) return fail("not_found");
  if (res.status === 429) return fail("rate_limit");
  if (res.status === 400) return fail("invalid");
  if (!res.ok) return fail("bad_response");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return fail("bad_response");
  }
  const product = parseProduct(body);
  return product ? { ok: true, product } : fail("bad_response");
}

/** Result card for the VAT page. Every API field is escaped: the nomenclature is not trusted input. */
export function barcodeResultHtml(p: BarcodeProduct): string {
  const extra = [p.brand, p.category].filter(Boolean).join(" · ");
  return `<p class="font-semibold text-primary">${escapeHtml(p.name)}</p>
${extra ? `<p class="text-sm text-text-secondary">${escapeHtml(extra)}</p>` : ""}
<p class="mt-2"><span class="text-text-secondary">Cotă TVA recomandată:</span> <strong>${p.vat_rate}%</strong></p>
<p class="ut-hint">Verifică încadrarea pe factură și în nomenclatorul casei de marcat.</p>`;
}
