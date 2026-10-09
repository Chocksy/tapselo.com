import { ANAF_MAX_CUIS_PER_REQUEST, ANAF_TVA_URL, CACHE_TTL_MS } from "./constants.mjs";
import { isValidCui, normalizeCui } from "./normalize.mjs";
import { interpretAnafResponse, looksLikeHtmlResponse } from "./parse.mjs";
import { AnafRequestThrottle } from "./throttle.mjs";

const throttle = new AnafRequestThrottle();

export function todayIsoBucharest() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function cacheKey(cui, date) {
  return `anaf:v9:${cui}:${date}`;
}

async function readCache(cui, date) {
  const key = cacheKey(cui, date);
  const hit = await chrome.storage.local.get(key);
  const row = hit[key];
  if (!row || typeof row.exp !== "number" || row.exp < Date.now()) return null;
  return row.company ?? null;
}

async function writeCache(cui, date, company) {
  const key = cacheKey(cui, date);
  await chrome.storage.local.set({ [key]: { company, exp: Date.now() + CACHE_TTL_MS } });
}

export async function lookupCuiAnaf(rawCui) {
  const cui = normalizeCui(rawCui);
  if (!cui || !isValidCui(cui)) {
    return { ok: false, error: "CUI invalid. Verifică cifrele (cu sau fără prefix RO)." };
  }
  const date = todayIsoBucharest();
  const cached = await readCache(cui, date);
  if (cached) return { ok: true, company: cached };

  await throttle.acquire();
  let res;
  try {
    res = await fetch(ANAF_TVA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{ cui: Number(cui), data: date }]),
    });
  } catch {
    return { ok: false, error: "ANAF indisponibil. Încearcă din nou peste câteva minute." };
  }

  const text = await res.text();
  if (!res.ok || looksLikeHtmlResponse(text)) {
    return { ok: false, error: "ANAF indisponibil. Încearcă din nou peste câteva minute." };
  }

  const outcome = interpretAnafResponse(text, cui);
  if (outcome.kind === "unavailable") {
    return { ok: false, error: "ANAF indisponibil. Încearcă din nou peste câteva minute." };
  }
  if (outcome.kind === "not_found") {
    return { ok: false, error: "ANAF nu are date pentru acest CUI la data interogării." };
  }

  await writeCache(cui, date, outcome.company);
  return { ok: true, company: outcome.company };
}

/** Batch helper — respects ANAF max 100 CUIs (unused in UI; guard for future). */
export function assertBatchSize(n) {
  if (n < 1 || n > ANAF_MAX_CUIS_PER_REQUEST) {
    throw new RangeError(`ANAF permite maxim ${ANAF_MAX_CUIS_PER_REQUEST} CUI-uri per cerere`);
  }
}
