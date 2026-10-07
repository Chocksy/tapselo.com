// Public Supabase values for the shopper pages (/c, /p, /confirmare, /dezabonare).
// The anon key is public by design: it ships in the POS and admin apps too.
// Access is limited by RLS and by the grants on the public_* functions.
export const SUPABASE_URL = "https://rhatutvdltsbhidghfhh.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYXR1dHZkbHRzYmhpZGdoZmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDMyMjMsImV4cCI6MjA3NjgxOTIyM30.TbdRLlPdo-sLUa8UgfD2ZaFxzTFRR7umkL5nsACAe9M"; // gitleaks:allow (anon key, public by design)

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "network" | "missing" | "rejected"; message: string };

export const MSG_NETWORK = "Nu avem legătură la internet. Verifică conexiunea și încearcă din nou.";
export const MSG_MISSING = "Serviciul nu este disponibil acum. Încearcă din nou mai târziu.";

// POST {url}/rest/v1/rpc/<fn> with the anon key.
// kind "missing": function not found (404 / PGRST202) or server error.
// kind "rejected": the function raised (bad input, module off, ...).
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, kind: "network", message: MSG_NETWORK };
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (res.ok) return { ok: true, data: body as T };

  const code = (body as { code?: string } | null)?.code;
  const detail = (body as { message?: string } | null)?.message ?? text;
  console.warn(`rpc ${fn} failed`, res.status, code, detail);
  if (res.status === 404 || code === "PGRST202" || res.status >= 500) {
    return { ok: false, kind: "missing", message: MSG_MISSING };
  }
  return { ok: false, kind: "rejected", message: detail };
}

// PostgREST returns a table function as an array and a composite as an object.
export function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "/c/panviro-hala" or "/c/panviro-hala/" -> "panviro-hala"; null when missing or invalid.
export function slugFromPath(prefix: "c" | "p"): string | null {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] !== prefix) return null;
  // ?s= works on `astro dev`, which ignores public/_redirects.
  const raw = parts[1] ?? new URLSearchParams(location.search).get("s");
  if (!raw) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
  return SLUG_RE.test(slug) ? slug : null;
}

// Mirrors public.normalize_phone (supabase/migrations/20260927110000_customers.sql).
// Returns E.164 ("+40712345678") or null when the number is not usable.
export function normalizePhone(p: string): string | null {
  const d = p.replace(/[^0-9]/g, "");
  if (d === "") return null;
  let r: string;
  if (p.trim().startsWith("+")) r = d;
  else if (d.startsWith("00")) r = d.slice(2);
  else if (d.startsWith("0")) r = "40" + d.slice(1);
  else if (d.length === 9 && d.startsWith("7")) r = "40" + d;
  else r = d;
  if (r.length < 8 || r.length > 15) return null;
  return "+" + r;
}

export function isEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export interface SignupInfo {
  store_name: string | null;
  company_name: string | null;
  cui: string | null;
  address: string | null;
  privacy_email: string | null;
  member_discount_percent: number | string | null;
  enabled: boolean | null;
}

// Fill every [data-f="<field>"] under root with text (never HTML).
export function fillFields(root: ParentNode, values: Record<string, string>): void {
  root.querySelectorAll<HTMLElement>("[data-f]").forEach((el) => {
    const v = values[el.dataset.f ?? ""];
    if (v !== undefined) el.textContent = v;
  });
}

// Business facts as display strings, with readable fallbacks.
export function infoFields(info: SignupInfo): Record<string, string> {
  const pct = Number(info.member_discount_percent ?? 0);
  return {
    store_name: info.store_name || "Magazinul",
    company_name: info.company_name || info.store_name || "Magazinul",
    cui: info.cui || "-",
    address: info.address || "-",
    privacy_email: info.privacy_email || "",
    discount: pct > 0 ? formatPercent(pct) : "",
  };
}

export function formatPercent(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}
