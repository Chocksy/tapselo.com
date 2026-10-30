import { internalPath } from "../internal-url.ts";
import { markdownToPlainText } from "../markdown.ts";

import { TAPS_PRICE_CANON } from "../../data/tapselo-product-copy.ts";

const SITE = "https://tapselo.com";

/** Canonical URLs on tapselo.com end with "/" (see <link rel="canonical"> in Layout). */
export function canonicalUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE}${p.endsWith("/") ? p : `${p}/`}`;
}

export interface FaqItem {
  q: string;
  /** Plain text for FAQPage JSON-LD (and default UI when `aHtml` is omitted). */
  a: string;
  /** Trusted HTML for on-page FAQ answer only. */
  aHtml?: string;
}

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail of every tool page; the JSON-LD BreadcrumbList uses the same names. */
export function toolBreadcrumbs(heading: string, path: string): Crumb[] {
  return [
    { name: "Acasă", path: "/" },
    { name: "Unelte gratuite", path: "/unelte/" },
    { name: heading, path },
  ];
}

export interface BreadcrumbLink {
  label: string;
  /** Omitted on the current page. */
  href?: string;
}

/** Every crumb links to its page except the last one (the current page). */
export function breadcrumbLinks(crumbs: Crumb[]): BreadcrumbLink[] {
  return crumbs.map((c, i) => ({
    label: c.name,
    href: i < crumbs.length - 1 ? internalPath(c.path) : undefined,
  }));
}

export function webApplicationJsonLd(opts: {
  name: string;
  path: string;
  description: string;
  operatingSystem?: string;
  /** Desktop/mobile product pages: canon subscription wording, no price-0 / isAccessibleForFree. */
  tapseloProductPricing?: boolean;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    url: canonicalUrl(opts.path),
    applicationCategory: "BusinessApplication",
    operatingSystem: opts.operatingSystem ?? "Web",
    inLanguage: "ro",
    description: opts.description,
  };
  if (opts.tapseloProductPricing) {
    base.offers = {
      "@type": "Offer",
      priceCurrency: "RON",
      description: TAPS_PRICE_CANON,
    };
    return base;
  }
  base.isAccessibleForFree = true;
  base.offers = { "@type": "Offer", price: "0", priceCurrency: "RON" };
  return base;
}

export function faqPageJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: markdownToPlainText(item.a) },
    })),
  };
}

export function breadcrumbJsonLd(items: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export interface ToolJsonLdInput {
  path: string;
  /** Visible H1, also the last breadcrumb. */
  heading: string;
  /** Branded app name for WebApplication. */
  appName: string;
  description: string;
  faq: FaqItem[];
}

export function toolJsonLd(i: ToolJsonLdInput): Record<string, unknown>[] {
  return [
    webApplicationJsonLd({ name: i.appName, path: i.path, description: i.description }),
    faqPageJsonLd(i.faq),
    breadcrumbJsonLd(toolBreadcrumbs(i.heading, i.path)),
  ];
}
