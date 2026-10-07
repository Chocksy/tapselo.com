// Shared PostHog config and event helpers for tapselo.com (browser) and tests.
// Same project as the POS app (Chocksy/pos); ingestion via t.tapselo.com reverse proxy.

/** Public write-only ingestion key (safe to ship in static assets). */
export const DEFAULT_POSTHOG_KEY = "phc_OOLSIySyCe9V37b0M2M40s8riA38SDYJ7zEhsiMAtyn"; // gitleaks:allow

export const DEFAULT_POSTHOG_HOST = "https://t.tapselo.com";
/** EU project — t.tapselo.com resolves to europehog.com / eu PostHog. */
export const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com";

export type AnalyticsTool =
  | "a4200"
  | "calculator_tva"
  | "registru_casa"
  | "generator_nir"
  | "generator_cod_de_bare"
  | "calculator_adaos"
  | "verificare_cod_de_bare";

export type ToolAction =
  | "check"
  | "generate_pdf"
  | "download"
  | "calculate"
  | "lookup"
  | "ean_lookup"
  | "camera_scan"
  | "print"
  | "download_png"
  | "download_svg"
  | "print_sheet";

export type A4200CheckResult = "ok" | "errors";

const SENSITIVE_KEY = /^(ean|cui|nui|cif|filename|file|name|price|message|query|barcode|product|supplier|company|tax)/i;
const EAN_BODY = /\d{8,13}/;

export interface PostHogPublicConfig {
  key: string;
  apiHost: string;
  uiHost: string;
}

export function resolvePostHogConfig(env: {
  PUBLIC_POSTHOG_KEY?: string;
  PUBLIC_POSTHOG_HOST?: string;
}): PostHogPublicConfig {
  const key = env.PUBLIC_POSTHOG_KEY?.trim() || DEFAULT_POSTHOG_KEY;
  const apiHost = (env.PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  return { key, apiHost, uiHost: DEFAULT_POSTHOG_UI_HOST };
}

/** No analytics on local dev hosts or Astro dev server. */
export function isAnalyticsEnabled(hostname: string, astroDev: boolean): boolean {
  if (astroDev) return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
  return true;
}

/** Drop sensitive keys and EAN-like digit runs before events leave the browser. */
export function sanitizeEventProperties(
  properties: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value === null) {
      out[key] = null;
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
      continue;
    }
    if (typeof value === "string") {
      const compact = value.replace(/[\s-]/g, "");
      if (EAN_BODY.test(compact)) continue;
      out[key] = value;
    }
  }
  return out;
}

export function toolUsedProperties(
  tool: AnalyticsTool,
  action: ToolAction,
  extra?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  return sanitizeEventProperties({ tool, action, ...extra });
}

export function barcodeLookupProperties(foundTapselo: boolean, foundOff: boolean): Record<string, boolean> {
  return { found_tapselo: foundTapselo, found_off: foundOff };
}
