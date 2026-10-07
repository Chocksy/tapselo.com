// Client-side lookup for the TVA calculator.
// GET {PUBLIC_BARCODE_API_URL}/barcodes/:ean -> { ean, name, brand?, category?, vat_rate }
// Default base is "/api": the same-origin Pages Function functions/api/barcodes/[ean].ts.
// Only these fields are read; anything else in the response (prices, shop data) is dropped.

import { isValidEan13 } from "../ean13.ts";
import { escapeHtml } from "../generators/page.ts";
import { isVatRateRo, type VatRateRo } from "./vat.ts";

export interface BarcodeProduct {
  ean: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  vat_rate: VatRateRo;
}

export type BarcodeLookupErrorCode = "invalid" | "in_store" | "not_found" | "rate_limit" | "network" | "bad_response";

export type BarcodeLookupResult =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; code: BarcodeLookupErrorCode; message: string };

export const LOOKUP_TIMEOUT_MS = 8000;

export const MESSAGES: Record<BarcodeLookupErrorCode, string> = {
  invalid: "Codul de bare nu pare corect. Introdu un EAN-13 de 13 cifre, cu cifra de control corectă.",
  in_store: "Codurile care încep cu 20–29 sunt coduri interne de magazin (de exemplu de la cântar) și nu identifică un produs.",
  not_found: "Nu am găsit produsul în baza de date Tapselo. Verifică codul sau caută cota TVA pe factura furnizorului.",
  rate_limit: "Prea multe căutări într-un interval scurt. Așteaptă un minut și încearcă din nou.",
  network: "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
  bad_response: "Serviciul de căutare nu răspunde acum. Încearcă mai târziu.",
};

export const DEFAULT_BARCODE_API = "/api";

/** Base URL for the lookup: unset or empty -> "/api"; "off" hides the barcode block (returns ""). */
export function barcodeApiBase(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (v.toLowerCase() === "off") return "";
  return (v || DEFAULT_BARCODE_API).replace(/\/+$/, "");
}

export type EanCheck = { ok: true; ean: string } | { ok: false; code: "invalid" | "in_store"; message: string };

/**
 * Same rules as the endpoint, so a doomed request is never sent: EAN-13 with a valid check digit,
 * not an in-store code (prefix 20–29). Spaces and dashes are stripped; a 12-digit UPC-A gets its leading 0.
 */
export function checkEan(raw: string): EanCheck {
  const digits = raw.replace(/[\s-]/g, "");
  const ean = /^\d{12}$/.test(digits) ? `0${digits}` : digits;
  if (!isValidEan13(ean)) return { ok: false, code: "invalid", message: MESSAGES.invalid };
  if (ean[0] === "2") return { ok: false, code: "in_store", message: MESSAGES.in_store };
  return { ok: true, ean };
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
