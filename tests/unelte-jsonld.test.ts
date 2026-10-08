import assert from "node:assert/strict";
import { test } from "node:test";
import { breadcrumbLinks, canonicalUrl, toolBreadcrumbs, toolJsonLd } from "../src/lib/unelte/jsonld.ts";

test("canonicalUrl matches the site's trailing-slash canonicals", () => {
  assert.equal(canonicalUrl("/unelte/calculator-tva"), "https://tapselo.com/unelte/calculator-tva/");
  assert.equal(canonicalUrl("unelte"), "https://tapselo.com/unelte/");
  assert.equal(canonicalUrl("/"), "https://tapselo.com/");
});

test("toolJsonLd: WebApplication, FAQPage and a breadcrumb from Acasă", () => {
  const faq = [{ q: "Întrebare?", a: "Răspuns." }];
  const [app, faqPage, crumbs] = toolJsonLd({
    path: "/unelte/calculator-tva",
    heading: "Calculator TVA 2026 – adaugă sau scoate TVA 21% / 11%",
    appName: "Calculator TVA Tapselo",
    description: "d",
    faq,
  });
  assert.equal(app["@type"], "WebApplication");
  assert.equal(app.url, "https://tapselo.com/unelte/calculator-tva/");
  assert.equal(app.inLanguage, "ro");
  assert.equal(faqPage["@type"], "FAQPage");
  assert.equal((faqPage.mainEntity as unknown[]).length, 1);
  assert.equal(crumbs["@type"], "BreadcrumbList");
  assert.deepEqual(
    (crumbs.itemListElement as { name: string; item: string; position: number }[]).map((c) => [c.position, c.name, c.item]),
    [
      [1, "Acasă", "https://tapselo.com/"],
      [2, "Unelte gratuite", "https://tapselo.com/unelte/"],
      [3, "Calculator TVA 2026 – adaugă sau scoate TVA 21% / 11%", "https://tapselo.com/unelte/calculator-tva/"],
    ],
  );
  assert.deepEqual(toolBreadcrumbs("H", "/unelte/x").map((c) => c.name), ["Acasă", "Unelte gratuite", "H"]);
});

test("breadcrumbLinks: every crumb links except the current page", () => {
  assert.deepEqual(breadcrumbLinks(toolBreadcrumbs("Verificare A4200", "/ghid/verificare-a4200")), [
    { label: "Acasă", href: "/" },
    { label: "Unelte gratuite", href: "/unelte" },
    { label: "Verificare A4200", href: undefined },
  ]);
});
