import {
  barcodeLookupProperties,
  isAnalyticsEnabled,
  resolvePostHogConfig,
  sanitizeCtaClickProperties,
  sanitizeEventProperties,
  toolUsedProperties,
  type AnalyticsTool,
  type PostHogPublicConfig,
  type ToolAction,
} from "./analytics.ts";
import { buildCtaClickProperties, type CtaClickProperties } from "./cta-click.ts";

type PostHogLike = {
  capture: (
    event: string,
    properties?: Record<string, unknown>,
    options?: { send_instantly?: boolean; transport?: "sendBeacon" },
  ) => void;
};

const BOOT_KEY = "__tapseloPostHogBoot";
const CTA_QUEUE_MAX = 16;
/** Suppress duplicate capture from click + auxclick or rapid re-clicks on the same anchor. */
const CTA_DEDUPE_MS = 400;
const recentCtaByAnchor = new WeakMap<HTMLAnchorElement, number>();

type BootState = {
  promise: Promise<PostHogLike | null>;
  /** `undefined` = still loading; `null` = boot failed. */
  client?: PostHogLike | null;
  drainHooked?: boolean;
};

type WindowBoot = Window & { [BOOT_KEY]?: BootState };

function bootState(): BootState | undefined {
  return (window as WindowBoot)[BOOT_KEY];
}

function setBootState(state: BootState): void {
  (window as WindowBoot)[BOOT_KEY] = state;
}

function shouldRun(astroDev: boolean): boolean {
  return isAnalyticsEnabled(window.location.hostname, astroDev);
}

function hookBootDrain(state: BootState): void {
  if (state.drainHooked) return;
  state.drainHooked = true;
  void state.promise.then((ph) => {
    const s = bootState();
    if (!s) return;
    s.client = ph;
    drainCtaQueue();
  });
}

function startBoot(config: PostHogPublicConfig): Promise<PostHogLike | null> {
  return import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(config.key, {
        api_host: config.apiHost,
        ui_host: config.uiHost,
        persistence: "memory",
        disable_cookie: true,
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
        disable_session_recording: true,
        // Only pageviews and our own events: no survey, dead-click, exception or web-vitals scripts and requests.
        disable_surveys: true,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_performance: false,
        loaded: (ph) => {
          ph.config.disable_session_recording = true;
        },
      });
      return posthog as PostHogLike;
    })
    .catch(() => null);
}

function ensureBoot(astroDev = import.meta.env.DEV): BootState | undefined {
  if (!shouldRun(astroDev)) return undefined;
  let state = bootState();
  if (!state) {
    state = { promise: startBoot(resolvePostHogConfig(import.meta.env)) };
    setBootState(state);
  }
  hookBootDrain(state);
  return state;
}

const pendingCta: CtaClickProperties[] = [];

function sendCtaToPosthog(ph: PostHogLike, properties: CtaClickProperties): void {
  ph.capture("cta_click", sanitizeCtaClickProperties(properties), {
    send_instantly: true,
    transport: "sendBeacon",
  });
}

function drainCtaQueue(): void {
  const state = bootState();
  if (!state || state.client === undefined) return;
  if (state.client === null) {
    pendingCta.length = 0;
    return;
  }
  while (pendingCta.length) {
    sendCtaToPosthog(state.client, pendingCta.shift()!);
  }
}

export function initSiteAnalytics(config: PostHogPublicConfig, astroDev = import.meta.env.DEV): void {
  if (!shouldRun(astroDev)) return;
  if (bootState()) return;
  const state: BootState = { promise: startBoot(config) };
  setBootState(state);
  hookBootDrain(state);
}

function capture(
  event: string,
  properties: Record<string, unknown>,
  astroDev = import.meta.env.DEV,
  options?: { send_instantly?: boolean; transport?: "sendBeacon" },
): void {
  if (!shouldRun(astroDev)) return;
  const state = ensureBoot(astroDev);
  if (!state) return;
  void state.promise.then((ph) => {
    if (!ph) return;
    ph.capture(event, sanitizeEventProperties(properties), options);
  });
}

export function trackToolUsed(
  tool: AnalyticsTool,
  action: ToolAction,
  extra?: Record<string, unknown>,
): void {
  capture("tool_used", toolUsedProperties(tool, action, extra));
}

export function trackBarcodeLookup(foundTapselo: boolean, foundOff: boolean): void {
  capture("barcode_lookup", barcodeLookupProperties(foundTapselo, foundOff));
}

function captureCtaClick(properties: CtaClickProperties): void {
  if (!shouldRun(import.meta.env.DEV)) return;
  const state = ensureBoot();
  if (!state) return;

  if (state.client) {
    sendCtaToPosthog(state.client, properties);
    return;
  }

  if (pendingCta.length >= CTA_QUEUE_MAX) pendingCta.shift();
  pendingCta.push(properties);
  drainCtaQueue();
}

function onCtaPointer(e: MouseEvent): void {
  if (e.button !== 0 && e.button !== 1) return;
  const el = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!el) return;

  const now = Date.now();
  const lastAt = recentCtaByAnchor.get(el);
  if (lastAt !== undefined && now - lastAt < CTA_DEDUPE_MS) return;
  recentCtaByAnchor.set(el, now);

  const props = buildCtaClickProperties(el, window.location);
  if (!props) return;
  captureCtaClick(props);
}

export function bindCtaClickTracking(root: Document | HTMLElement = document): void {
  root.addEventListener("click", onCtaPointer, true);
  root.addEventListener("auxclick", onCtaPointer, true);
}