// Client-side lookup against Tapselo admin public API (tapselo-pos).
// GET {PUBLIC_BARCODE_API_URL}/barcodes/:ean -> { ean, name, brand?, category?, vat_rate }

export interface BarcodeProduct {
  ean: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  vat_rate: number;
}

export type BarcodeLookupErrorCode = "invalid" | "not_found" | "rate_limit" | "network" | "bad_response";

export type BarcodeLookupResult =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; code: BarcodeLookupErrorCode; message: string };

export function barcodeEndpoint(baseUrl: string, ean: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/barcodes/${encodeURIComponent(ean)}`;
}

function parseProduct(body: unknown): BarcodeProduct | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const ean = typeof o.ean === "string" ? o.ean : null;
  const name = typeof o.name === "string" ? o.name.trim() : null;
  const vat = o.vat_rate;
  if (!ean || !name || typeof vat !== "number" || !Number.isFinite(vat)) return null;
  if (![0, 11, 21].includes(vat)) return null;
  const brand = typeof o.brand === "string" ? o.brand.trim() || null : null;
  const category = typeof o.category === "string" ? o.category.trim() || null : null;
  return { ean, name, brand, category, vat_rate: vat };
}

export async function lookupBarcode(
  baseUrl: string,
  ean: string,
  fetchFn: typeof fetch = fetch,
): Promise<BarcodeLookupResult> {
  const url = barcodeEndpoint(baseUrl, ean);
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
  } catch {
    return { ok: false, code: "network", message: "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou." };
  }
  if (res.status === 404) {
    return {
      ok: false,
      code: "not_found",
      message: "Produsul nu este în baza Tapselo. Verifică codul sau adaugă produsul manual în nomenclator.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      code: "rate_limit",
      message: "Prea multe căutări într-un interval scurt. Așteaptă un minut și încearcă din nou.",
    };
  }
  if (res.status === 400) {
    return { ok: false, code: "invalid", message: "Cod EAN invalid. Folosește 8 sau 13 cifre, cu cifra de control corectă." };
  }
  if (!res.ok) {
    return { ok: false, code: "bad_response", message: "Serviciul de căutare nu răspunde acum. Încearcă mai târziu." };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: "bad_response", message: "Răspuns neașteptat de la server." };
  }
  const product = parseProduct(body);
  if (!product) {
    return { ok: false, code: "bad_response", message: "Răspuns neașteptat de la server." };
  }
  return { ok: true, product };
}
