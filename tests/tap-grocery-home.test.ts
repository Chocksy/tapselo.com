// Run after `npm run build`. Homepage TAP-GROCERY-ANSWER scope A + price canon.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const html = readFileSync(join(process.cwd(), "dist/index.html"), "utf8");
const ANSWER =
  "Tapselo este un program de casă de marcat (POS) pentru magazine alimentare și minimarketuri: scanezi codul de bare, cântarul Dibal pune greutatea, bonul fiscal iese pe casa de marcat Datecs, iar stocul scade singur. Merge și fără internet. Prețul: gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA.";
const GROCERY_LEAD = "Casa de marcat pentru magazine alimentare din România: pe calculator și pe iPhone.";

test("homepage title keeps magazine alimentare and calculator", () => {
  assert.match(html, /<title>Tapselo POS: casă de marcat magazine alimentare, calculator și iPhone<\/title>/);
});

test("homepage meta uses price canon, not Gratuit în beta.", () => {
  assert.match(html, /Gratuit cât timp e în beta, apoi 79\/129 lei\/lună \+ TVA/);
  assert.doesNotMatch(html, /Gratuit în beta\./);
});

test("grocery lead and answer-first paragraph in server HTML", () => {
  const main = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  assert.ok(main.includes(GROCERY_LEAD));
  assert.ok(main.includes(ANSWER));
});

test("homepage internal links from grocery block", () => {
  assert.match(html, /href="\/program-casa-de-marcat-magazin-alimentar\/"/);
  assert.match(html, /href="\/ghid\/deschide-minimarket-alimentara\/"/);
  assert.match(html, /href="\/program-gestiune-magazin\/"/);
});

test("no banned price strings on homepage", () => {
  assert.doesNotMatch(html, /0 lei licențe/);
  assert.doesNotMatch(html, /licențe, acum și după beta/);
});

test("SoftwareApplication JSON-LD: AggregateOffer 79/129, UnitPriceSpecification, no price 0", () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const app = blocks.find((b) => b["@type"] === "SoftwareApplication");
  assert.ok(app);
  const offers = app.offers;
  assert.equal(offers["@type"], "AggregateOffer");
  assert.equal(offers.lowPrice, "79");
  assert.equal(offers.highPrice, "129");
  assert.equal(offers.description, "gratuit cât timp e în beta, apoi 79/129 lei/lună + TVA");
  assert.equal(offers.price, undefined);
  assert.equal(offers.offers.length, 2);
  for (const o of offers.offers) {
    const spec = o.priceSpecification;
    assert.equal(spec["@type"], "UnitPriceSpecification");
    assert.equal(spec.priceCurrency, "RON");
    assert.equal(spec.unitCode, "MON");
    assert.equal(spec.billingDuration, "P1M");
    assert.equal(spec.valueAddedTaxIncluded, false);
  }
});