// GET /api/barcodes/{ean} (functions/api/barcodes/[ean].ts): one EAN-13 -> name and
// Romanian VAT from the Tapselo catalog, via public_barcode_vat(p_ean) in the pos repo.
// Response: { ean, name, category?, vat_rate: 21 | 11 }, the contract the TVA tool's
// lookupBarcode() reads. Same origin as the page, so no CORS.

import { isValidEan13 } from "./ean13.ts";
import { MSG_MISSING, type RpcResult } from "./supabase-public.ts";

export interface BarcodeVat {
  ean: string;
  name: string;
  category?: string;
  vat_rate: 21 | 11;
}

export const MSG_INVALID = "Cod de bare invalid. Introdu un EAN-13 de 13 cifre, cu cifra de control corectă.";
export const MSG_IN_STORE =
  "Codurile care încep cu 20–29 sunt coduri interne de magazin (de exemplu de la cântar) și nu identifică un produs.";
export const MSG_NOT_FOUND = "Nu avem acest cod de bare în baza Tapselo.";
export const MSG_RATE_LIMIT = "Prea multe căutări într-un interval scurt. Așteaptă un minut și încearcă din nou.";

const PER_MINUTE = 30;
const PER_DAY = 500;

interface Bucket {
  minute: number;
  minuteCount: number;
  day: number;
  dayCount: number;
}

/**
 * Per-IP fixed windows, per Worker isolate: a burst guard, not a global quota.
 * The Cloudflare rate-limiting rule on /api/barcodes/* is the global one.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /** Seconds to wait, or 0 when the request is allowed. */
  hit(ip: string, now = Date.now()): number {
    const minute = Math.floor(now / 60_000);
    const day = Math.floor(now / 86_400_000);
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (b.minute !== minute) this.buckets.delete(k);
    }
    let b = this.buckets.get(ip);
    if (!b || b.day !== day) b = { minute, minuteCount: 0, day, dayCount: 0 };
    if (b.minute !== minute) {
      b.minute = minute;
      b.minuteCount = 0;
    }
    this.buckets.set(ip, b);
    if (b.dayCount >= PER_DAY) return Math.ceil(((day + 1) * 86_400_000 - now) / 1000);
    if (b.minuteCount >= PER_MINUTE) return Math.ceil(((minute + 1) * 60_000 - now) / 1000);
    b.minuteCount += 1;
    b.dayCount += 1;
    return 0;
  }
}

/** Only the whitelisted fields, with the types the tool expects; null for anything else. */
export function toBarcodeVat(ean: string, data: unknown): BarcodeVat | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name || o.ean !== ean || (o.vat_rate !== 21 && o.vat_rate !== 11)) return null;
  const out: BarcodeVat = { ean, name, vat_rate: o.vat_rate };
  if (typeof o.category === "string" && o.category.trim()) out.category = o.category.trim();
  return out;
}

function json(body: unknown, status: number, method: string, headers: Record<string, string> = {}): Response {
  // "<" escaped so the body is inert even if something ever embeds it in HTML.
  const text = JSON.stringify(body).replace(/</g, "\\u003c");
  return new Response(method === "HEAD" ? null : text, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      ...headers,
    },
  });
}

const cache = (seconds: number) => ({ "Cache-Control": `public, max-age=${seconds}` });
const NO_STORE = { "Cache-Control": "no-store" };

export async function handleBarcodeRequest(
  request: Request,
  rawEan: string | undefined,
  deps: { lookup: (ean: string) => Promise<RpcResult<unknown>>; limiter: RateLimiter; now?: number },
): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const ean = (rawEan ?? "").trim();
  if (!isValidEan13(ean)) return json({ error: MSG_INVALID }, 400, method, cache(86_400));
  if (ean[0] === "2") return json({ error: MSG_IN_STORE }, 400, method, cache(86_400));

  // Set by Cloudflare on every request; a client-sent value is overwritten.
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const wait = deps.limiter.hit(ip, deps.now);
  if (wait > 0) return json({ error: MSG_RATE_LIMIT }, 429, method, { ...NO_STORE, "Retry-After": String(wait) });

  const res = await deps.lookup(ean);
  if (!res.ok) return json({ error: MSG_MISSING }, 503, method, NO_STORE);
  if (res.data === null) return json({ error: MSG_NOT_FOUND }, 404, method, cache(300));

  const product = toBarcodeVat(ean, res.data);
  if (!product) return json({ error: MSG_MISSING }, 503, method, NO_STORE);
  return json(product, 200, method, cache(3600));
}
