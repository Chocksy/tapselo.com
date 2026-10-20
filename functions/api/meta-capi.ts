/**
 * POST /api/meta-capi: forwards the browser's demo_started (from /demo/ only) to the Meta
 * Conversions API with the same event_id, for deduplication with the Pixel event.
 *
 * Pages env (runtime, Settings → Environment variables; the token as an encrypted secret):
 *   META_CAPI_TOKEN       Conversions API access token (secret). Unset: no-op (204).
 *   META_PIXEL_ID         Same value as the build-time PUBLIC_META_PIXEL_ID. Unset: no-op.
 *   META_GRAPH_VERSION    optional, e.g. v24.0
 *   META_TEST_EVENT_CODE  optional, Events Manager test code
 */
import { buildCapiEvent, capiConfig, graphRequest, isAllowedOrigin, type CapiEnv } from "../../src/lib/meta/capi.ts";

type Ctx = { request: Request; env: CapiEnv; waitUntil?: (p: Promise<unknown>) => void };

const MAX_BODY = 4096;

export async function handleMetaCapi(ctx: Ctx, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const { request, env } = ctx;
  const cfg = capiConfig(env);
  if (!cfg) return new Response(null, { status: 204 });

  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = buildCapiEvent(body, {
    origin,
    ip: request.headers.get("CF-Connecting-IP"),
    userAgent: request.headers.get("User-Agent"),
    cookie: request.headers.get("Cookie"),
  });
  if (!event) return new Response(null, { status: 400 });

  const { url, init } = graphRequest(cfg, event);
  const send = fetchImpl(url, init)
    .then((r) => {
      if (!r.ok) console.log(`meta-capi: graph status ${r.status}`);
    })
    .catch(() => console.log("meta-capi: graph request failed"));
  if (ctx.waitUntil) ctx.waitUntil(send);
  else await send;
  return new Response(null, { status: 202 });
}

export const onRequestPost = (ctx: Ctx) => handleMetaCapi(ctx);
