const SITE = "https://tapselo.com";

export interface FaqItem {
  q: string;
  a: string;
}

export function webApplicationJsonLd(opts: {
  name: string;
  path: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    url: `${SITE}${opts.path}`,
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

export function breadcrumbJsonLd(items: { name: string; path?: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path ? `${SITE}${item.path}` : undefined,
    })),
  };
}

export function toolJsonLd(path: string, name: string, description: string, faq: FaqItem[]): Record<string, unknown>[] {
  return [
    webApplicationJsonLd({ name, path, description }),
    faqPageJsonLd(faq),
    breadcrumbJsonLd([
      { name: "Unelte gratuite", path: "/unelte" },
      { name, path },
    ]),
  ];
}
