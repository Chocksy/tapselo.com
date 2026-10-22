// Per-error help pages under /ghid/erori-datecs/<slug>/ (TAP-018), from src/lib/kb/datecs-error-pages.json.
// Every quoted string carries {doc, page}; tests/datecs-error-pages.test.ts checks it against docs/sources/datecs/.
import raw from "../kb/datecs-error-pages.json";
import { internalPath } from "../internal-url.ts";
import { canonicalUrl } from "../unelte/jsonld.ts";

export type DocId = "M1" | "M2" | "M3";
export type Quote = { text: string; doc: DocId; page: number; note?: string };
export type StepGroup = { title: string; intro: string; steps: Quote[]; after?: Quote };
export type DatecsErrorPage = {
  slug: string;
  code: string;
  message: string;
  title: string;
  h1: string;
  meta: string;
  short: string;
  m1: { page: number; en: string; ro: string; sic?: boolean };
  display: { model: string; message: Quote; remedy: Quote }[];
  displayNote?: string;
  stepGroups: StepGroup[];
  extraQuotes?: Quote[];
  faq: { q: string; a: string }[];
  related: string[];
  howto: boolean;
};
type Source = { title: string; url: string; file: string };
type Data = { verified_on: string; published: string; sources: Record<DocId, Source>; service: Quote[]; codeList: Quote; pages: DatecsErrorPage[] };

export const datecsPagesData = raw as unknown as Data;
export const datecsErrorPages = datecsPagesData.pages;
export const HUB_PATH = "/ghid/erori-datecs/";
/** Confirmed by Razvan on 2026-10-22; the only Tapselo-shows-error claim allowed (see test). */
export const TAPSELO_LINE = "Tapselo afișează textul erorii casei de marcat direct pe ecranul casei, în aplicație.";

export const datecsPagePath = (slug: string) => internalPath(`/ghid/erori-datecs/${slug}`);
export const datecsPageByCode = (code: string) => datecsErrorPages.find((p) => p.code === code);

export function cite(q: { doc: DocId; page: number }): string {
  return `${datecsPagesData.sources[q.doc].title}, pag. ${q.page}`;
}

/** TechArticle + FAQPage (+ HowTo) + BreadcrumbList for one page. */
export function datecsPageJsonLd(p: DatecsErrorPage): Record<string, unknown>[] {
  const url = canonicalUrl(datecsPagePath(p.slug));
  const d = datecsPagesData;
  const docs = [...new Set(["M1" as DocId, ...p.display.flatMap((x) => [x.message.doc]), ...p.stepGroups.flatMap((g) => g.steps.map((s) => s.doc))])];
  const out: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: p.h1,
      description: p.meta,
      inLanguage: "ro-RO",
      datePublished: d.published,
      dateModified: d.verified_on,
      url,
      mainEntityOfPage: url,
      citation: docs.map((k) => d.sources[k].url),
      author: { "@type": "Organization", name: "Tapselo", url: "https://tapselo.com/" },
      publisher: { "@type": "Organization", name: "Tapselo", url: "https://tapselo.com/" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Ghid pentru magazine", item: canonicalUrl("/ghid/") },
        { "@type": "ListItem", position: 2, name: "Erori casă de marcat Datecs", item: canonicalUrl(HUB_PATH) },
        { "@type": "ListItem", position: 3, name: p.h1, item: url },
      ],
    },
  ];
  if (p.howto) {
    const steps = p.stepGroups.flatMap((g) => g.steps.map((s) => ({ g: g.title, s })));
    out.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: p.h1,
      inLanguage: "ro-RO",
      step: steps.map(({ g, s }, i) => ({ "@type": "HowToStep", position: i + 1, name: g, text: s.text })),
    });
  }
  return out;
}
