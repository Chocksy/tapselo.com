// Server side of demo_started: validate the browser beacon and build the Conversions API body.
import { DEMO_EVENT, pickDemoParams, resolvePixelId, type DemoParams } from "./pixel.ts";

export const ALLOWED_ORIGINS = ["https://tapselo.com", "https://www.tapselo.com"];
/** Page that may send events (Razvan, 2026-10-20: pixel only on /demo/). */
export const EVENT_PATH = "/demo/";
export const DEFAULT_GRAPH_VERSION = "v24.0";

export type CapiEnv = {
  META_CAPI_TOKEN?: string;
  META_PIXEL_ID?: string;
  META_GRAPH_VERSION?: string;
  META_TEST_EVENT_CODE?: string;
};

export type CapiRequestMeta = {
  origin: string | null;
  ip: string | null;
  userAgent: string | null;
  cookie: string | null;
  now?: number;
};

export type CapiEvent = {
  event_name: typeof DEMO_EVENT;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: { client_ip_address?: string; client_user_agent?: string; fbp?: string; fbc?: string };
  custom_data: DemoParams;
};

/** Token + pixel ID, or null: the endpoint is a no-op without both. */
export function capiConfig(env: CapiEnv): { token: string; pixelId: string; version: string; testCode?: string } | null {
  const token = (env.META_CAPI_TOKEN ?? "").trim();
  const pixelId = resolvePixelId(env.META_PIXEL_ID);
  if (!token || !pixelId) return null;
  const version = /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION ?? "") ? env.META_GRAPH_VERSION! : DEFAULT_GRAPH_VERSION;
  const testCode = /^[A-Z0-9]{3,20}$/.test(env.META_TEST_EVENT_CODE ?? "") ? env.META_TEST_EVENT_CODE : undefined;
  return { token, pixelId, version, testCode };
}

export function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

function readCookie(cookie: string | null, name: string): string | null {
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

/** Validate the beacon body; returns the event or null. Only allowlisted fields are copied. */
export function buildCapiEvent(body: unknown, meta: CapiRequestMeta): CapiEvent | null {
  if (!isAllowedOrigin(meta.origin)) return null;
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.event_name !== DEMO_EVENT) return null;
  if (typeof b.event_id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(b.event_id)) return null;
  if (typeof b.event_source_url !== "string") return null;
  let src: URL;
  try {
    src = new URL(b.event_source_url);
  } catch {
    return null;
  }
  if (!isAllowedOrigin(src.origin) || src.pathname !== EVENT_PATH) return null;

  const user_data: CapiEvent["user_data"] = {};
  if (meta.ip && /^[0-9a-fA-F:.]{3,45}$/.test(meta.ip)) user_data.client_ip_address = meta.ip;
  if (meta.userAgent) user_data.client_user_agent = meta.userAgent.slice(0, 512);
  const fbp = readCookie(meta.cookie, "_fbp");
  if (fbp && /^fb\.\d\.\d+\.\d+$/.test(fbp)) user_data.fbp = fbp;
  const fbc = readCookie(meta.cookie, "_fbc");
  if (fbc && /^fb\.\d\.\d+\.[A-Za-z0-9_-]{1,500}$/.test(fbc)) user_data.fbc = fbc;

  return {
    event_name: DEMO_EVENT,
    event_time: Math.floor((meta.now ?? Date.now()) / 1000),
    event_id: b.event_id,
    // Origin + path only: no query string (it could carry fbclid/utm values we do not need here).
    event_source_url: `${src.origin}${src.pathname}`,
    action_source: "website",
    user_data,
    custom_data: pickDemoParams(b.custom_data),
  };
}

export function graphRequest(cfg: NonNullable<ReturnType<typeof capiConfig>>, event: CapiEvent): { url: string; init: RequestInit } {
  const body: Record<string, unknown> = { data: [event] };
  if (cfg.testCode) body.test_event_code = cfg.testCode;
  return {
    url: `https://graph.facebook.com/${cfg.version}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  };
}
