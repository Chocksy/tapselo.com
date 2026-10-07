// Open Food Facts enrichment for /unelte/verificare-cod-de-bare.
// Server: GET /api/off/{ean} (functions/api/off/[ean].ts) calls the OFF v2 product API with a
// descriptive User-Agent, as OFF asks of servers, keeps a whitelisted set of fields and caches for a day.
// Client: lookupOff() reads that endpoint; offProductHtml() renders it with every field escaped.
// OFF data is ODbL, product images CC BY-SA: the card always carries the attribution and the product link.

import { isValidEan13 } from "../ean13.ts";
import { cache, json, MSG_IN_STORE, MSG_INVALID, MSG_RATE_LIMIT, NO_STORE, type RateLimiter } from "../barcode-vat.ts";
import { escapeHtml } from "../generators/page.ts";

export const OFF_FIELDS = [
  "product_name",
  "brands",
  "image_front_small_url",
  "image_url",
  "quantity",
  "categories",
  "nutriscore_grade",
  "countries",
] as const;

export const OFF_USER_AGENT = "Tapselo/1.0 (https://tapselo.com/unelte/verificare-cod-de-bare/; contact@tapselo.com)";
export const OFF_TIMEOUT_MS = 6000;
export const OFF_CACHE_SECONDS = 86_400;
export const MSG_OFF_NOT_FOUND = "Produsul nu există în Open Food Facts.";
export const MSG_OFF_UNAVAILABLE = "Open Food Facts nu răspunde acum. Încearcă mai târziu.";

const IMAGE_RE = /^https:\/\/images\.openfoodfacts\.org\/images\/products\/[\w/.-]+\.(?:jpe?g|png|webp)$/i;
const NUTRISCORE = new Set(["a", "b", "c", "d", "e"]);
const MAX_TEXT = 160;

export interface OffProduct {
  ean: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  /** The most specific category, e.g. "Sucuri de portocale". */
  category: string | null;
  nutriscore: "a" | "b" | "c" | "d" | "e" | null;
  countries: string | null;
  /** Only https://images.openfoodfacts.org product images. */
  image: string | null;
  /** Product page on Open Food Facts, for the attribution link. */
  url: string;
}

export function offApiUrl(ean: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${OFF_FIELDS.join(",")}`;
}

export function offProductUrl(ean: string): string {
  return `https://world.openfoodfacts.org/product/${encodeURIComponent(ean)}`;
}

/** Trimmed single-line text without control characters, capped; null when nothing is left. */
function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1).trimEnd()}…` : t;
}

/** OFF lists ("Băuturi, en:orange-juices") -> entries; untranslated tags lose the "xx:" prefix and dashes. */
function taxonomyList(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => {
      const t = s.trim();
      return /^[a-z]{2}:/i.test(t) ? t.slice(3).replace(/-/g, " ").trim() : t;
    })
    .filter(Boolean);
}

function cleanImage(v: unknown): string | null {
  return typeof v === "string" && IMAGE_RE.test(v) ? v : null;
}

function cleanNutriscore(v: unknown): OffProduct["nutriscore"] {
  const g = typeof v === "string" ? v.trim().toLowerCase() : "";
  return NUTRISCORE.has(g) ? (g as OffProduct["nutriscore"]) : null;
}

const hasData = (p: OffProduct) => Boolean(p.name || p.brand || p.quantity || p.category || p.image);

/**
 * OFF v2 body ({ status: 1, product: {...} }) -> OffProduct with only the whitelisted fields;
 * null when the product is missing or carries none of name, brand, quantity, category, image.
 */
export function toOffProduct(ean: string, body: unknown): OffProduct | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  if (o.status !== 1 || !o.product || typeof o.product !== "object") return null;
  const p = o.product as Record<string, unknown>;
  const categories = taxonomyList(p.categories);
  const countries = taxonomyList(p.countries);
  const out: OffProduct = {
    ean,
    name: cleanText(p.product_name),
    brand: cleanText(taxonomyList(p.brands).slice(0, 2).join(", ")),
    quantity: cleanText(p.quantity),
    category: cleanText(categories[categories.length - 1]),
    nutriscore: cleanNutriscore(p.nutriscore_grade),
    countries: cleanText(countries.slice(0, 5).join(", ")),
    image: cleanImage(p.image_front_small_url) ?? cleanImage(p.image_url),
    url: offProductUrl(ean),
  };
  return hasData(out) ? out : null;
}

/** Re-validates the proxy payload in the browser: same field rules, the url must be the OFF product page. */
export function parseOffPayload(ean: string, body: unknown): OffProduct | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  if (o.ean !== ean) return null;
  const out: OffProduct = {
    ean,
    name: cleanText(o.name),
    brand: cleanText(o.brand),
    quantity: cleanText(o.quantity),
    category: cleanText(o.category),
    nutriscore: cleanNutriscore(o.nutriscore),
    countries: cleanText(o.countries),
    image: cleanImage(o.image),
    url: offProductUrl(ean),
  };
  return hasData(out) ? out : null;
}

export interface OffDeps {
  limiter: RateLimiter;
  fetchFn?: typeof fetch;
  /** caches.default on Cloudflare; null in tests and local dev. */
  cache?: Cache | null;
  waitUntil?: (p: Promise<unknown>) => void;
  now?: number;
  timeoutMs?: number;
}

function forMethod(res: Response, method: string): Response {
  return method === "HEAD" ? new Response(null, { status: res.status, headers: res.headers }) : res;
}

export async function handleOffRequest(request: Request, rawEan: string | undefined, deps: OffDeps): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const ean = (rawEan ?? "").trim();
  if (!isValidEan13(ean)) return json({ error: MSG_INVALID }, 400, method, cache(OFF_CACHE_SECONDS));
  if (ean[0] === "2") return json({ error: MSG_IN_STORE }, 400, method, cache(OFF_CACHE_SECONDS));

  const key = new Request(new URL(`/api/off/${ean}`, request.url).toString(), { method: "GET" });
  const hit = await deps.cache?.match(key);
  if (hit) return forMethod(hit, method);

  // Cached answers are free; only upstream calls count against the per-IP budget.
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const wait = deps.limiter.hit(ip, deps.now);
  if (wait > 0) return json({ error: MSG_RATE_LIMIT }, 429, method, { ...NO_STORE, "Retry-After": String(wait) });

  const fetchFn = deps.fetchFn ?? fetch;
  let upstream: Response;
  try {
    upstream = await fetchFn(offApiUrl(ean), {
      headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(deps.timeoutMs ?? OFF_TIMEOUT_MS),
    });
  } catch {
    return json({ error: MSG_OFF_UNAVAILABLE }, 503, method, NO_STORE);
  }
  if (upstream.status !== 404 && !upstream.ok) return json({ error: MSG_OFF_UNAVAILABLE }, 503, method, NO_STORE);

  let product: OffProduct | null = null;
  if (upstream.ok) {
    try {
      product = toOffProduct(ean, await upstream.json());
    } catch {
      return json({ error: MSG_OFF_UNAVAILABLE }, 503, method, NO_STORE);
    }
  }

  const res = product
    ? json(product, 200, "GET", cache(OFF_CACHE_SECONDS))
    : json({ error: MSG_OFF_NOT_FOUND }, 404, "GET", cache(OFF_CACHE_SECONDS));
  if (deps.cache) {
    const put = deps.cache.put(key, res.clone());
    if (deps.waitUntil) deps.waitUntil(put);
    else await put;
  }
  return forMethod(res, method);
}

export type OffLookupResult = { ok: true; product: OffProduct } | { ok: false; code: "not_found" | "unavailable" };

export function offEndpoint(ean: string): string {
  return `/api/off/${encodeURIComponent(ean)}`;
}

export async function lookupOff(ean: string, fetchFn: typeof fetch = fetch, timeoutMs = OFF_TIMEOUT_MS + 2000): Promise<OffLookupResult> {
  let res: Response;
  try {
    res = await fetchFn(offEndpoint(ean), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, code: "unavailable" };
  }
  if (res.status === 404) return { ok: false, code: "not_found" };
  if (!res.ok) return { ok: false, code: "unavailable" };
  try {
    const product = parseOffPayload(ean, await res.json());
    return product ? { ok: true, product } : { ok: false, code: "not_found" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export const OFF_ATTRIBUTION = "Date și imagini: Open Food Facts (ODbL / CC BY-SA)";

/** Product card from Open Food Facts; every value, URL included, is escaped. */
export function offProductHtml(p: OffProduct): string {
  const rows: [string, string | null][] = [
    ["Denumire", p.name],
    ["Marcă", p.brand],
    ["Cantitate", p.quantity],
    ["Categorie", p.category],
    ["Nutri-Score", p.nutriscore ? p.nutriscore.toUpperCase() : null],
    ["Țări", p.countries],
  ];
  const dl = rows
    .filter((r): r is [string, string] => Boolean(r[1]))
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");
  const alt = p.name ? `Imagine produs: ${p.name}` : "Imagine produs";
  const img = p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(alt)}" width="112" height="112" loading="lazy" referrerpolicy="no-referrer" class="off-img" />`
    : "";
  return `<div class="off-card">${img}<dl class="off-dl">${dl}</dl></div>
<p class="ut-hint" data-off-attribution>Date și imagini: <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="font-semibold text-accent underline-offset-2 hover:underline">Open Food Facts</a> (ODbL / CC BY-SA)</p>`;
}
