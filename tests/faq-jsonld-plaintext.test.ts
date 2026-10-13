// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildArticleJsonLd, parseArticlesFile } from "../src/lib/articles/schema.ts";
import { faqPageJsonLd } from "../src/lib/unelte/jsonld.ts";
import { markdownToPlainText } from "../src/lib/markdown.ts";

test("markdownToPlainText strips bold and links", () => {
  assert.equal(
    markdownToPlainText("Text cu **bold** și [link](https://anaf.ro)"),
    "Text cu bold și link",
  );
});

test("FAQPage JSON-LD acceptedAnswer has no markdown asterisks", () => {
  const articles = parseArticlesFile(
    JSON.parse(readFileSync(join(process.cwd(), "src/lib/kb/articles.json"), "utf8")),
  );
  const offline = articles.find((a) => a.slug === "casa-de-marcat-fara-internet");
  assert.ok(offline?.faq?.length);
  const nodes = buildArticleJsonLd(offline, articles);
  const faq = nodes.find((n) => n["@type"] === "FAQPage");
  assert.ok(faq);
  const answers = (faq.mainEntity as { acceptedAnswer: { text: string } }[]).map((q) => q.acceptedAnswer.text);
  for (const text of answers) {
    assert.doesNotMatch(text, /\*\*/, `literal ** in JSON-LD: ${text.slice(0, 80)}`);
  }

  const toolFaq = faqPageJsonLd([{ q: "Q?", a: "Răspuns cu **accent**." }]);
  const toolAnswer = (toolFaq.mainEntity as { acceptedAnswer: { text: string } }[])[0].acceptedAnswer.text;
  assert.equal(toolAnswer, "Răspuns cu accent.");
});
