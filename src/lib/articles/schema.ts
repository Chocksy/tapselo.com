// Support articles: validate src/lib/kb/articles.json and build JSON-LD for /ghid/articole/*.

const SITE = "https://tapselo.com";
const PUBLISHER = {
  "@type": "Organization" as const,
  name: "Tapselo",
  url: SITE,
  logo: `${SITE}/logo.png`,
};

export const A4200_CHECKER_PATH = "/ghid/verificare-a4200/";

export type ArticleType = "howto" | "article";
export type ArticleCta = "a4200" | "default";

export type ArticleSource = { title: string; url: string };
export type ArticleFaq = { q: string; a: string };
export type ArticleStep = { name: string; text: string };

export type SupportArticle = {
  slug: string;
  title: string;
  description: string;
  type: ArticleType;
  updated: string;
  verifiedOn: string;
  sources: ArticleSource[];
  tags: string[];
  related: string[];
  cta: ArticleCta;
  body: string;
  faq?: ArticleFaq[];
  steps?: ArticleStep[];
};

export type ArticlesFile = {
  articles: SupportArticle[];
};

export class ArticleSchemaError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(`articles.json: ${field}: ${message}`);
    this.name = "ArticleSchemaError";
    this.field = field;
  }
}

function isNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new ArticleSchemaError(field, "required non-empty string");
  return v.trim();
}

function isIsoDate(v: unknown, field: string): string {
  const s = isNonEmptyString(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ArticleSchemaError(field, "expected YYYY-MM-DD");
  return s;
}

function validateSource(raw: unknown, field: string): ArticleSource {
  if (!raw || typeof raw !== "object") throw new ArticleSchemaError(field, "expected object");
  const o = raw as Record<string, unknown>;
  const title = isNonEmptyString(o.title, `${field}.title`);
  const url = isNonEmptyString(o.url, `${field}.url`);
  if (!/^https?:\/\//.test(url)) throw new ArticleSchemaError(`${field}.url`, "expected http(s) URL");
  return { title, url };
}

function validateFaq(raw: unknown, field: string): ArticleFaq {
  if (!raw || typeof raw !== "object") throw new ArticleSchemaError(field, "expected object");
  const o = raw as Record<string, unknown>;
  return { q: isNonEmptyString(o.q, `${field}.q`), a: isNonEmptyString(o.a, `${field}.a`) };
}

function validateStep(raw: unknown, field: string): ArticleStep {
  if (!raw || typeof raw !== "object") throw new ArticleSchemaError(field, "expected object");
  const o = raw as Record<string, unknown>;
  return { name: isNonEmptyString(o.name, `${field}.name`), text: isNonEmptyString(o.text, `${field}.text`) };
}

function validateArticle(raw: unknown, index: number): SupportArticle {
  const field = `articles[${index}]`;
  if (!raw || typeof raw !== "object") throw new ArticleSchemaError(field, "expected object");
  const o = raw as Record<string, unknown>;

  const slug = isNonEmptyString(o.slug, `${field}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ArticleSchemaError(`${field}.slug`, "expected kebab-case slug");
  }

  const type = isNonEmptyString(o.type, `${field}.type`);
  if (type !== "howto" && type !== "article") throw new ArticleSchemaError(`${field}.type`, "howto | article");

  const cta = isNonEmptyString(o.cta, `${field}.cta`);
  if (cta !== "a4200" && cta !== "default") throw new ArticleSchemaError(`${field}.cta`, "a4200 | default");

  if (!Array.isArray(o.sources) || o.sources.length === 0) {
    throw new ArticleSchemaError(`${field}.sources`, "at least one source required");
  }
  const sources = o.sources.map((s, i) => validateSource(s, `${field}.sources[${i}]`));

  if (!Array.isArray(o.tags) || o.tags.length === 0) {
    throw new ArticleSchemaError(`${field}.tags`, "at least one tag required");
  }
  const tags = o.tags.map((t, i) => isNonEmptyString(t, `${field}.tags[${i}]`));

  if (!Array.isArray(o.related) || o.related.length < 2) {
    throw new ArticleSchemaError(`${field}.related`, "at least two related slugs required");
  }
  const related = o.related.map((t, i) => isNonEmptyString(t, `${field}.related[${i}]`));

  let faq: ArticleFaq[] | undefined;
  if (o.faq !== undefined) {
    if (!Array.isArray(o.faq) || o.faq.length === 0) throw new ArticleSchemaError(`${field}.faq`, "non-empty array");
    faq = o.faq.map((f, i) => validateFaq(f, `${field}.faq[${i}]`));
  }

  let steps: ArticleStep[] | undefined;
  if (o.steps !== undefined) {
    if (!Array.isArray(o.steps) || o.steps.length === 0) throw new ArticleSchemaError(`${field}.steps`, "non-empty array");
    steps = o.steps.map((s, i) => validateStep(s, `${field}.steps[${i}]`));
  }

  if (type === "howto" && (!steps || steps.length === 0)) {
    throw new ArticleSchemaError(`${field}.steps`, "howto articles require steps");
  }

  return {
    slug,
    title: isNonEmptyString(o.title, `${field}.title`),
    description: isNonEmptyString(o.description, `${field}.description`),
    type: type as ArticleType,
    updated: isIsoDate(o.updated, `${field}.updated`),
    verifiedOn: isIsoDate(o.verifiedOn, `${field}.verifiedOn`),
    sources,
    tags,
    related,
    cta: cta as ArticleCta,
    body: isNonEmptyString(o.body, `${field}.body`),
    faq,
    steps,
  };
}

/** Parse and validate articles.json at build time. */
export function parseArticlesFile(raw: unknown): SupportArticle[] {
  if (!raw || typeof raw !== "object") throw new ArticleSchemaError("root", "expected object");
  const articles = (raw as ArticlesFile).articles;
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new ArticleSchemaError("articles", "non-empty array required");
  }
  const parsed = articles.map((a, i) => validateArticle(a, i));
  const slugs = new Set<string>();
  for (const a of parsed) {
    if (slugs.has(a.slug)) throw new ArticleSchemaError("articles", `duplicate slug: ${a.slug}`);
    slugs.add(a.slug);
  }
  for (const a of parsed) {
    for (const rel of a.related) {
      if (!slugs.has(rel)) throw new ArticleSchemaError(`articles.${a.slug}.related`, `unknown slug: ${rel}`);
      if (rel === a.slug) throw new ArticleSchemaError(`articles.${a.slug}.related`, "cannot relate to self");
    }
  }
  return parsed;
}

export function articlePath(slug: string): string {
  return `/ghid/articole/${slug}/`;
}

export function articleUrl(slug: string): string {
  return `${SITE}${articlePath(slug)}`;
}

export type JsonLd = Record<string, unknown>;

/** Article + optional HowTo / FAQPage + BreadcrumbList for one support article. */
export function buildArticleJsonLd(article: SupportArticle, all: SupportArticle[]): JsonLd[] {
  const url = articleUrl(article.slug);
  const graph: JsonLd[] = [];

  graph.push({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    dateModified: article.updated,
    inLanguage: "ro-RO",
    url,
    mainEntityOfPage: url,
    author: PUBLISHER,
    publisher: PUBLISHER,
  });

  graph.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ghid pentru magazine", item: `${SITE}/ghid` },
      { "@type": "ListItem", position: 2, name: "Articole de suport", item: `${SITE}/ghid/articole` },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ],
  });

  if (article.steps && article.steps.length > 0) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: article.title,
      description: article.description,
      inLanguage: "ro-RO",
      step: article.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    });
  }

  if (article.faq && article.faq.length > 0) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: article.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  // Ensure related slugs exist (already validated).
  void all;

  return graph;
}

/** Map pathname → lastmod for sitemap serialize. */
export function articleLastmodByPath(articles: SupportArticle[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of articles) m.set(articlePath(a.slug), a.updated);
  m.set("/ghid/articole", articles.reduce((max, a) => (a.updated > max ? a.updated : max), articles[0].updated));
  return m;
}
