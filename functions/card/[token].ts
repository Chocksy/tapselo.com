/**
 * /card/{token}: public loyalty card of one customer, Cloudflare Pages Function
 *
 * 1. Validates the token (22 base64url characters)
 * 2. Calls public_card(p_token) with the anon key (src/lib/supabase-public.ts)
 * 3. Returns the card page (src/lib/card-render.ts); never cached, never indexed
 *
 * public_card returns null for an unknown, revoked or erased card.
 * Any failure (null, function missing, network) renders the friendly not-found page.
 * Local check without the RPC: http://localhost:8788/card/AAAAAAAAAAAAAAAAAAAAAA?mock=1
 * (ignored on other hosts); add &variant=off|top|bronz for the other states,
 * and &apple=1 to show the Apple Wallet button.
 *
 * The "Adauga in Apple Wallet" link shows only for iPhone, iPad and Mac
 * User-Agents. The page has no script (CSP), so the check runs here.
 */

import { rpc } from "../../src/lib/supabase-public.ts";
import { renderCardPage, renderCardNotFound, TOKEN_RE, type CardPayload } from "../../src/lib/card-render.ts";
import { MOCK_CARD, MOCK_CARD_VARIANTS } from "../../src/lib/card-mock.ts";

const APPLE_UA_RE = /iPhone|iPad|Macintosh/;

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

function html(body: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function onRequest(context: { request: Request; params: Record<string, string | string[]> }) {
  const { request, params } = context;
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const notFound = () => html(renderCardNotFound(), 404, method);

  // Tokens are case-sensitive: no lowercasing, no decoding (base64url needs none).
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  if (!token || !TOKEN_RE.test(token)) return notFound();

  const url = new URL(request.url);
  if (url.searchParams.get("mock") === "1" && LOCAL_HOSTS.has(url.hostname)) {
    const variant = url.searchParams.get("variant") ?? "";
    const mock = Object.hasOwn(MOCK_CARD_VARIANTS, variant) ? MOCK_CARD_VARIANTS[variant] : MOCK_CARD;
    return html(renderCardPage(mock, { token, isApple: url.searchParams.get("apple") === "1" }), 200, method);
  }

  const res = await rpc<CardPayload | null>("public_card", { p_token: token });
  if (!res.ok || !res.data || typeof res.data !== "object" || !res.data.card_code) return notFound();

  const isApple = APPLE_UA_RE.test(request.headers.get("User-Agent") ?? "");
  return html(renderCardPage(res.data, { token, isApple }), 200, method);
}
