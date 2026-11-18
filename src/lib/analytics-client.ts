import {
  barcodeLookupProperties,
  isAnalyticsEnabled,
  resolvePostHogConfig,
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

type BootState = { promise: Promise<PostHogLike | null> };

function bootState(): BootState | undefined {
  return (window as Window & { [BOOT_KEY]?: BootState })[BOOT_KEY];
}

function setBootState(state: BootState): void {
  (window as Window & { [BOOT_KEY]?: BootState })[BOOT_KEY] = state;
}

function shouldRun(astroDev: boolean): boolean {
  return isAnalyticsEnabled(window.location.hostname, astroDev);
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

export function initSiteAnalytics(config: PostHogPublicConfig, astroDev = import.meta.env.DEV): void {
  if (!shouldRun(astroDev)) return;
  if (bootState()) return;
  setBootState({ promise: startBoot(config) });
}

function capture(
  event: string,
  properties: Record<string, unknown>,
  astroDev = import.meta.env.DEV,
  options?: { send_instantly?: boolean; transport?: "sendBeacon" },
): void {
  if (!shouldRun(astroDev)) return;
  let state = bootState();
  if (!state) {
    state = { promise: startBoot(resolvePostHogConfig(import.meta.env)) };
    setBootState(state);
  }
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

/** @deprecated Use delegated cta_click tracking; retained for tests or manual calls. */
export function trackCtaClick(properties: CtaClickProperties): void {
  captureCtaClick(properties);
}

function captureCtaClick(properties: CtaClickProperties): void {
  capture("cta_click", properties, import.meta.env.DEV, {
    send_instantly: true,
    transport: "sendBeacon",
  });
}

export function bindCtaClickTracking(root: Document | HTMLElement = document): void {
  root.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const props = buildCtaClickProperties(el, window.location);
      if (!props) return;
      captureCtaClick(props);
    },
    true,
  );
}