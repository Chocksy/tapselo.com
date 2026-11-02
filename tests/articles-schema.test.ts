// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildArticleJsonLd,
  parseArticlesFile,
  articlePath,
  ArticleSchemaError,
} from "../src/lib/articles/schema.ts";

const articlesJson = JSON.parse(readFileSync(join(process.cwd(), "src/lib/kb/articles.json"), "utf8"));

test("articles.json validates and includes six live articles", () => {
  const articles = parseArticlesFile(articlesJson);
  assert.equal(articles.length, 6);
  const slugs = articles.map((a) => a.slug).sort();
  assert.deepEqual(slugs, [
    "casa-de-marcat-fara-internet",
    "cod-qr-bon-fiscal",
    "depunere-a4200",
    "erori-dukintegrator",
    "export-p7b-anaf",
    "raport-z-datecs-fp-70",
  ]);
});

test("articles.json rejects missing related slug", () => {
  const broken = {
    articles: [
      {
        ...articlesJson.articles[0],
        related: ["depunere-a4200", "nu-exista"],
      },
    ],
  };
  assert.throws(() => parseArticlesFile(broken), ArticleSchemaError);
});

test("buildArticleJsonLd emits Article, BreadcrumbList, HowTo and FAQPage", () => {
  const articles = parseArticlesFile(articlesJson);
  const howto = articles.find((a) => a.slug === "depunere-a4200");
  assert.ok(howto);
  const nodes = buildArticleJsonLd(howto, articles);
  const types = nodes.map((n) => n["@type"]);
  assert.ok(types.includes("Article"));
  assert.ok(types.includes("BreadcrumbList"));
  assert.ok(types.includes("HowTo"));

  const faqArticle = articles.find((a) => a.slug === "erori-dukintegrator");
  assert.ok(faqArticle);
  const faqNodes = buildArticleJsonLd(faqArticle, articles);
  assert.ok(faqNodes.some((n) => n["@type"] === "FAQPage"));

  const offlineHowto = articles.find((a) => a.slug === "casa-de-marcat-fara-internet");
  assert.ok(offlineHowto);
  const offlineLd = buildArticleJsonLd(offlineHowto, articles);
  const offlineTypes = offlineLd.map((n) => n["@type"]);
  assert.ok(offlineTypes.includes("HowTo"));
  assert.ok(offlineTypes.includes("FAQPage"));
});

test("article paths match route prefix", () => {
  const articles = parseArticlesFile(articlesJson);
  for (const a of articles) {
    assert.equal(articlePath(a.slug), `/ghid/articole/${a.slug}/`);
  }
});

test("cod-qr-bon-fiscal reflects OUG 43/2026 suspension through 31 Oct 2027", () => {
  const articles = parseArticlesFile(articlesJson);
  const qr = articles.find((a) => a.slug === "cod-qr-bon-fiscal");
  assert.ok(qr);
  assert.equal(qr.updated, "2026-11-02");
  assert.equal(qr.verifiedOn, "2026-11-02");
  assert.match(qr.description, /31 octombrie 2027/);
  assert.doesNotMatch(qr.description, /1 noiembrie 2026/);

  const corpus = [qr.body, qr.description, ...(qr.faq ?? []).flatMap((f) => [f.q, f.a])].join("\n");
  assert.match(corpus, /31 octombrie 2027 inclusiv/);
  assert.match(corpus, /legislatie\.just\.ro\/Public\/DetaliiDocumentAfis\/315973/);
  assert.match(corpus, /OUG 43\/2026/);
  assert.doesNotMatch(corpus, /nu figurează pe legislatie\.just\.ro/i);
  assert.doesNotMatch(corpus, /pot fi aplicate din nou/i);
  assert.doesNotMatch(corpus, /pot fi din nou aplicate/i);
  assert.doesNotMatch(corpus, /se încheie suspendarea/i);
  assert.match(corpus, /termen inițial/i);
  assert.match(corpus, /1 noiembrie 2026/);
  assert.match(corpus, /2\.000–4\.000 lei/);
  assert.match(corpus, /nu tipărește.*QR/i);
  assert.match(corpus, /nu garantează/i);

  const nodes = buildArticleJsonLd(qr, articles);
  const faq = nodes.find((n) => n["@type"] === "FAQPage");
  assert.ok(faq);
  const faqText = JSON.stringify(faq);
  assert.match(faqText, /31 octombrie 2027 inclusiv/);
  assert.match(faqText, /OUG 43\/2026, art\. III/);
});
