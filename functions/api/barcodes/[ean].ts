/**
 * /api/barcodes/{ean}: EAN-13 -> product name and Romanian VAT — Cloudflare Pages Function
 *
 * Validates the code, rate-limits by CF-Connecting-IP, then calls
 * public_barcode_vat(p_ean) with the anon key (src/lib/supabase-public.ts).
 * Logic and messages: src/lib/barcode-vat.ts.
 */

import { rpc } from "../../../src/lib/supabase-public.ts";
import { handleBarcodeRequest, RateLimiter } from "../../../src/lib/barcode-vat.ts";

const limiter = new RateLimiter();

export async function onRequest(context: { request: Request; params: Record<string, string | string[]> }) {
  const raw = Array.isArray(context.params.ean) ? context.params.ean[0] : context.params.ean;
  return handleBarcodeRequest(context.request, raw, {
    lookup: (ean) => rpc<unknown>("public_barcode_vat", { p_ean: ean }),
    limiter,
  });
}
