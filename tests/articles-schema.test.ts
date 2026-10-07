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

test("articles.json validates and includes five live articles", () => {
  const articles = parseArticlesFile(articlesJson);
  assert.equal(articles.length, 5);
  const slugs = articles.map((a) => a.slug).sort();
  assert.deepEqual(slugs, [
    "casa-de-marcat-fara-internet",
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
    assert.equal(articlePath(a.slug), `/ghid/articole/${a.slug}`);
  }
});
