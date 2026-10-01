/**
 * /g/{id}: a document made by the AI plugin generators — Cloudflare Pages Function
 *
 * 1. Validates the id (10 base62 characters)
 * 2. Calls public_tool_draft(p_id) with the anon key (src/lib/supabase-public.ts)
 * 3. Renders by kind (src/lib/generators/render.ts), not-found page otherwise
 *
 * Cache: 60 s while a flyer picture is still pending, else 600 s.
 * Local check without the RPC: http://localhost:8788/g/abcdefghij?mock=flyer|labels|nir|recipe|cashbook
 * (ignored on other hosts).
 */

import { rpc } from "../../src/lib/supabase-public.ts";
import { IMAGE_URL_PREFIX } from "../../src/lib/offers-render.ts";
import { ID_RE, renderDraft } from "../../src/lib/generators/render.ts";
import { renderGeneratedNotFound, PRINT_SCRIPT_HASH } from "../../src/lib/generators/page.ts";
import { MOCK_DRAFTS } from "../../src/lib/generators/mock.ts";
import { isDraftKind } from "../../src/lib/generators/validate.ts";
import type { DraftRecord } from "../../src/lib/generators/types.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const CSP = [
  "default-src 'none'",
  `script-src '${PRINT_SCRIPT_HASH}'`,
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  `img-src 'self' ${new URL(IMAGE_URL_PREFIX).origin}`,
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
      "X-Robots-Tag": "noindex, nofollow",
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

  const notFound = () => html(renderGeneratedNotFound(), 404, 60, method);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id || !ID_RE.test(id)) return notFound();

  const url = new URL(request.url);
  const mock = url.searchParams.get("mock");
  if (mock && isDraftKind(mock) && LOCAL_HOSTS.has(url.hostname)) {
    const r = renderDraft(MOCK_DRAFTS[mock], id);
    return html(r.html, r.status, 0, method);
  }

  const res = await rpc<DraftRecord | null>("public_tool_draft", { p_id: id });
  if (!res.ok || !res.data || typeof res.data !== "object") return notFound();

  const r = renderDraft(res.data, id);
  return html(r.html, r.status, r.maxAge, method);
}
