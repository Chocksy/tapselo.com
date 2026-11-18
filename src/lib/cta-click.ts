// Pure helpers for PostHog cta_click (browser + unit tests).

export type CtaTarget = "demo" | "app-demo" | "app";

const TAPSELO_HOSTS = new Set(["tapselo.com", "www.tapselo.com"]);
const APP_HOST = "app.tapselo.com";

/** Pathname with a trailing slash; root stays `/`. */
export function normalizePagePath(pathname: string): string {
  const base = (pathname.split(/[?#]/)[0] || "/").trim();
  if (base === "/" || base === "") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function classifyCtaHref(
  href: string | null | undefined,
  baseUrl: string,
): { target: CtaTarget; targetUrl: string } | null {
  if (!href?.trim()) return null;
  let resolved: URL;
  try {
    resolved = new URL(href.trim(), baseUrl);
  } catch {
    return null;
  }
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;

  const host = resolved.hostname.toLowerCase();
  const baseOrigin = new URL(baseUrl).origin;
  const onMarketingDemo =
    isMarketingDemoPath(resolved.pathname) && (TAPSELO_HOSTS.has(host) || resolved.origin === baseOrigin);
  if (onMarketingDemo) {
    return { target: "demo", targetUrl: stripTargetUrl(resolved) };
  }
  if (host === APP_HOST) {
    const target: CtaTarget = resolved.searchParams.get("demo") === "1" ? "app-demo" : "app";
    return { target, targetUrl: stripTargetUrl(resolved) };
  }
  return null;
}

function isMarketingDemoPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  return path === "/demo";
}

function stripTargetUrl(url: URL): string {
  const copy = new URL(url.href);
  copy.search = "";
  copy.hash = "";
  return copy.href;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

export type CtaClickProperties = {
  location: string;
  page_path: string;
  target: CtaTarget;
  target_url: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export function buildCtaClickProperties(
  anchor: Pick<HTMLAnchorElement, "getAttribute" | "href">,
  pageUrl: Pick<URL, "pathname" | "search" | "href">,
): CtaClickProperties | null {
  const href = anchor.getAttribute("href") ?? anchor.href;
  const classified = classifyCtaHref(href, pageUrl.href);
  if (!classified) return null;

  const location = anchor.getAttribute("data-tapselo-cta")?.trim() || "untagged";
  const page_path = normalizePagePath(pageUrl.pathname);
  const props: CtaClickProperties = {
    location,
    page_path,
    target: classified.target,
    target_url: classified.targetUrl,
  };

  const q = new URLSearchParams(pageUrl.search);
  for (const key of UTM_KEYS) {
    const v = q.get(key)?.trim();
    if (v) (props as Record<string, string>)[key] = v;
  }
  return props;
}