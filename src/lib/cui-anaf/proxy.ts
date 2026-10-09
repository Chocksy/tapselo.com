// Server-side ANAF proxy for tapselo.com (Pages Function). One global client toward ANAF per isolate.

import { ANAF_MAX_CUIS_PER_REQUEST, ANAF_PROXY_CACHE_SECONDS, ANAF_TVA_URL } from "./constants.ts";
import { isValidCui, normalizeCui } from "./normalize.ts";
import { parseAnafResponse } from "./parse.ts";
import type { CompanyInfo } from "./types.ts";
import { AnafRequestThrottle } from "./throttle.ts";

export const MSG_INVALID_CUI =
  "CUI invalid. Verifică cifrele și încearcă din nou (cu sau fără prefix RO).";
export const MSG_NOT_FOUND = "ANAF nu are date pentru acest CUI la data interogării.";
export const MSG_RATE_LIMIT = "Prea multe interogări către ANAF. Așteaptă o secundă și încearcă din nou.";
export const MSG_ANAF_DOWN =
  "Serviciul ANAF nu răspunde acum. Încearcă din nou peste câteva minute.";
export const MSG_BAD_METHOD = "Metodă neacceptată.";

const globalThrottle = new AnafRequestThrottle();

export function todayIsoBucharest(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  const text = JSON.stringify(body).replace(/</g, "\\u003c");
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      ...extraHeaders,
    },
  });
}

export interface AnafProxyDeps {
  fetch: typeof fetch;
  throttle?: AnafRequestThrottle;
  today?: string;
  cache?: Cache;
  cacheKey?: (cui: string, date: string) => string;
}

export async function fetchAnafCompany(
  cui: string,
  deps: AnafProxyDeps,
): Promise<{ ok: true; company: CompanyInfo } | { ok: false; status: number; error: string }> {
  const date = deps.today ?? todayIsoBucharest();
  const throttle = deps.throttle ?? globalThrottle;
  const cacheKey = deps.cacheKey ?? ((c, d) => `https://tapselo.internal/anaf-cui/${c}/${d}`);

  if (deps.cache) {
    const hit = await deps.cache.match(cacheKey(cui, date));
    if (hit) {
      const company = (await hit.json()) as CompanyInfo;
      return { ok: true, company };
    }
  }

  const retry = throttle.retryAfterSeconds();
  if (retry > 0) {
    return { ok: false, status: 429, error: MSG_RATE_LIMIT };
  }

  await throttle.acquire();

  let res: Response;
  try {
    res = await deps.fetch(ANAF_TVA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{ cui: Number(cui), data: date }]),
    });
  } catch {
    return { ok: false, status: 503, error: MSG_ANAF_DOWN };
  }

  if (!res.ok) return { ok: false, status: 503, error: MSG_ANAF_DOWN };

  let company: CompanyInfo | null;
  try {
    company = parseAnafResponse(await res.text(), cui);
  } catch {
    return { ok: false, status: 503, error: MSG_ANAF_DOWN };
  }

  if (!company) return { ok: false, status: 404, error: MSG_NOT_FOUND };

  if (deps.cache) {
    const payload = jsonResponse(company, 200, {
      "Cache-Control": `public, max-age=${ANAF_PROXY_CACHE_SECONDS}`,
    });
    await deps.cache.put(cacheKey(cui, date), payload);
  }

  return { ok: true, company };
}

export async function handleAnafCuiGet(
  request: Request,
  rawCui: string | undefined,
  deps: AnafProxyDeps,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse({ error: MSG_BAD_METHOD }, 405, { Allow: "GET, HEAD" });
  }

  const normalized = normalizeCui(rawCui);
  if (!normalized || !isValidCui(normalized)) {
    return jsonResponse({ error: MSG_INVALID_CUI }, 400, {
      "Cache-Control": "public, max-age=86400",
    });
  }

  const result = await fetchAnafCompany(normalized, deps);
  if (!result.ok) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (result.status === 429) headers["Retry-After"] = "1";
    return jsonResponse({ error: result.error }, result.status, headers);
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${ANAF_PROXY_CACHE_SECONDS}`,
      },
    });
  }

  return jsonResponse(result.company, 200, {
    "Cache-Control": `public, max-age=${ANAF_PROXY_CACHE_SECONDS}`,
  });
}

/** Guard for batch bodies (not exposed on the public endpoint). */
export function assertCuiBatchWithinLimit(count: number): void {
  if (count < 1 || count > ANAF_MAX_CUIS_PER_REQUEST) {
    throw new RangeError(`ANAF allows at most ${ANAF_MAX_CUIS_PER_REQUEST} CUIs per request`);
  }
}
