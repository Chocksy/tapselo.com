/**
 * /o/{slug}: public offers page of one store — Cloudflare Pages Function
 *
 * 1. Validates the slug
 * 2. Calls public_offers(p_slug) with the anon key (src/lib/supabase-public.ts)
 * 3. Returns full HTML with real title and Open Graph tags, so shared links preview well
 *
 * public_offers returns null for an unknown slug or when the store has the page off.
 * Any failure (null, function missing, network) renders the friendly not-found page.
 * Local check without the RPC: http://localhost:8788/o/hala?mock=1 (ignored on other hosts).
 */

import { rpc, SLUG_RE } from "../../src/lib/supabase-public.ts";
import { renderOffersPage, renderNotFoundPage, type OffersPayload } from "../../src/lib/offers-render.ts";
import { MOCK_OFFERS } from "../../src/lib/offers-mock.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

function html(body: string, status: number, maxAge: number, method: string): Response {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export async function onRequest(context: { request: Request; params: Record<string, string | string[]> }) {
  const { request, params } = context;
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const notFound = () => html(renderNotFoundPage(), 404, 60, method);

  const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  let slug: string;
  try {
    slug = decodeURIComponent(raw ?? "").toLowerCase();
  } catch {
    return notFound();
  }
  if (!SLUG_RE.test(slug)) return notFound();

  const url = new URL(request.url);
  if (url.searchParams.get("mock") === "1" && LOCAL_HOSTS.has(url.hostname)) {
    return html(renderOffersPage(MOCK_OFFERS, slug), 200, 0, method);
  }

  const res = await rpc<OffersPayload | null>("public_offers", { p_slug: slug });
  if (!res.ok || !res.data || typeof res.data !== "object" || !res.data.store) return notFound();

  return html(renderOffersPage(res.data, slug), 200, 300, method);
}
