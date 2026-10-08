import { internalPath } from "../internal-url.ts";

const SITE = "https://tapselo.com";

/** Canonical URLs on tapselo.com end with "/" (see <link rel="canonical"> in Layout). */
export function canonicalUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE}${p.endsWith("/") ? p : `${p}/`}`;
}

export interface FaqItem {
  q: string;
  a: string;
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

export function webApplicationJsonLd(opts: { name: string; path: string; description: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    url: canonicalUrl(opts.path),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ro",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "RON" },
    description: opts.description,
  };
}

export function faqPageJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
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
