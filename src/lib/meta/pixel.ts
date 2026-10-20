// Meta Pixel helpers shared by the /demo/ page script and the CAPI Pages Function.
// Only /demo/ loads any of this in the browser (see tests/meta-pixel.test.ts).

/** The one custom event we send. */
export const DEMO_EVENT = "demo_started";

/** custom_data keys allowed out of the browser and through /api/meta-capi. Nothing else passes. */
export const DEMO_PARAM_KEYS = [
  "landing_page",
  "page_path",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export type DemoParamKey = (typeof DEMO_PARAM_KEYS)[number];
export type DemoParams = Partial<Record<DemoParamKey, string>>;

export const LANDING_KEY = "tapselo_landing_page";
export const CONSENT_KEY = "tapselo_marketing_consent";

/** Pixel ID from env; null (feature off) unless it is a plain numeric ID. */
export function resolvePixelId(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  return /^\d{5,20}$/.test(v) ? v : null;
}

/** Links that start the demo: app.tapselo.com with ?demo=1, or demo.tapselo.com. */
export function isDemoHref(href: string | null | undefined, base = "https://tapselo.com/"): boolean {
  if (!href) return false;
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname === "demo.tapselo.com") return true;
  return u.hostname === "app.tapselo.com" && u.searchParams.get("demo") === "1";
}

/** Drop anything that could carry data we never send (barcodes, CUIs, prices, emails, phones). */
export function cleanParamValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 200);
  if (!s) return null;
  if (/@/.test(s)) return null;
  if (/\d[\d\s.,-]{4,}\d/.test(s)) return null;
  return s;
}

function cleanPath(v: unknown): string | null {
  const s = cleanParamValue(v);
  if (!s || !s.startsWith("/") || s.startsWith("//")) return null;
  return s.split(/[?#]/)[0];
}

/** Keep only allowlisted keys with clean values. */
export function pickDemoParams(raw: unknown): DemoParams {
  const out: DemoParams = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const k of DEMO_PARAM_KEYS) {
    const v = k === "landing_page" || k === "page_path" ? cleanPath(o[k]) : cleanParamValue(o[k]);
    if (v) out[k] = v;
  }
  return out;
}

/** demo_started params from the current URL and the stored landing page. */
export function buildDemoParams(pathname: string, search: string, landingPage: string | null): DemoParams {
  const q = new URLSearchParams(search);
  const raw: Record<string, string | undefined> = { landing_page: landingPage ?? pathname, page_path: pathname };
  for (const k of DEMO_PARAM_KEYS) if (k.startsWith("utm_")) raw[k] = q.get(k) ?? undefined;
  return pickDemoParams(raw);
}

/** Query params added to the demo link (and the .tapselo.com cookie) for the demo app's CAPI. */
export const CARRY_KEYS = [
  ...DEMO_PARAM_KEYS.filter((k) => k.startsWith("utm_")),
  "fbclid",
  "fbc",
  "fbp",
  "event_id",
  "landing_page",
] as const;
export type CarryKey = (typeof CARRY_KEYS)[number];
export const ATTR_COOKIE = "tapselo_attr";
export const ATTR_COOKIE_MAX_AGE = 7 * 24 * 3600;

/** Build the carry set (allowlisted, cleaned). fbclid/fbc/fbp/event_id use their own formats. */
export function buildCarry(input: {
  params: DemoParams;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  eventId: string;
}): Partial<Record<CarryKey, string>> {
  const out: Partial<Record<CarryKey, string>> = {};
  for (const k of CARRY_KEYS) {
    const v = (input.params as Record<string, string | undefined>)[k];
    if (v) out[k] = v;
  }
  if (input.fbclid && /^[A-Za-z0-9_-]{1,500}$/.test(input.fbclid)) out.fbclid = input.fbclid;
  if (input.fbc && /^fb\.\d\.\d+\.[A-Za-z0-9_-]{1,500}$/.test(input.fbc)) out.fbc = input.fbc;
  if (input.fbp && /^fb\.\d\.\d+\.\d+$/.test(input.fbp)) out.fbp = input.fbp;
  if (/^[A-Za-z0-9-]{8,64}$/.test(input.eventId)) out.event_id = input.eventId;
  return out;
}

/** Add the carry set to a demo href (existing params like demo=1 are kept). */
export function withCarry(href: string, carry: Partial<Record<CarryKey, string>>, base = "https://tapselo.com/"): string {
  const u = new URL(href, base);
  for (const [k, v] of Object.entries(carry)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

/** _fbc from fbclid when the pixel has not set it yet (Meta format fb.1.<ms>.<fbclid>). */
export function fbcFromFbclid(fbclid: string | null, nowMs: number): string | null {
  return fbclid && /^[A-Za-z0-9_-]{1,500}$/.test(fbclid) ? `fb.1.${nowMs}.${fbclid}` : null;
}

/** Consent flag the demo apps check before sending anything to Meta (contract in PR #71). */
export const CONSENT_COOKIE = "tapselo_consent";
export const CONSENT_COOKIE_MAX_AGE = 180 * 24 * 3600;
export type ConsentChoice = "granted" | "denied";
const COOKIE_ATTRS = "Domain=.tapselo.com; Path=/; SameSite=Lax; Secure";

/** Set-cookie strings for a choice. Refuz also deletes tapselo_attr. */
export function consentCookies(choice: ConsentChoice): string[] {
  if (choice === "granted") return [`${CONSENT_COOKIE}=marketing; ${COOKIE_ATTRS}; Max-Age=${CONSENT_COOKIE_MAX_AGE}`];
  return [`${CONSENT_COOKIE}=denied; ${COOKIE_ATTRS}; Max-Age=${CONSENT_COOKIE_MAX_AGE}`, `${ATTR_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`];
}

/** tapselo_attr cookie: the carry set plus the explicit consent marker. */
export function attrCookie(carry: Partial<Record<CarryKey, string>>): string {
  const payload = { ...carry, consent: "marketing" };
  return `${ATTR_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; ${COOKIE_ATTRS}; Max-Age=${ATTR_COOKIE_MAX_AGE}`;
}

/** Demo link with the carry set and tc=1 (consent given). */
export function demoHrefWithConsent(href: string, carry: Partial<Record<CarryKey, string>>, base = "https://tapselo.com/"): string {
  const u = new URL(withCarry(href, carry, base));
  u.searchParams.set("tc", "1");
  return u.toString();
}

/** Remove carried params (and tc) from a demo href, e.g. after Refuz. */
export function stripCarry(href: string, base = "https://tapselo.com/"): string {
  const u = new URL(href, base);
  for (const k of [...CARRY_KEYS, "tc"]) u.searchParams.delete(k);
  return u.toString();
}
