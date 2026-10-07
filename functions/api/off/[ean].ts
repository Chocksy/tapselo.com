/**
 * /api/off/{ean}: Open Food Facts product summary — Cloudflare Pages Function
 *
 * Validates the code, answers from the edge cache when it can, otherwise rate-limits by
 * CF-Connecting-IP and calls the OFF v2 API with a descriptive User-Agent. Found and
 * not-found answers are cached for a day. Logic: src/lib/unelte/off.ts.
 */

import { RateLimiter } from "../../../src/lib/barcode-vat.ts";
import { handleOffRequest } from "../../../src/lib/unelte/off.ts";

const limiter = new RateLimiter();

interface Context {
  request: Request;
  params: Record<string, string | string[]>;
  waitUntil: (p: Promise<unknown>) => void;
}

export async function onRequest(context: Context) {
  const raw = Array.isArray(context.params.ean) ? context.params.ean[0] : context.params.ean;
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default ?? null;
  return handleOffRequest(context.request, raw, {
    limiter,
    cache: edge,
    waitUntil: (p) => context.waitUntil(p),
  });
}
