// Run: npm test (node --test, native TypeScript type stripping, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  daysLabel,
  formatLei,
  formatDate,
  offersDescription,
  renderOffersPage,
  renderNotFoundPage,
  type OffersPayload,
} from "../src/lib/offers-render.ts";
import { MOCK_OFFERS } from "../src/lib/offers-mock.ts";

const clone = (): OffersPayload => structuredClone(MOCK_OFFERS);

test("formatters", () => {
  assert.equal(formatLei(3999), "39,99 lei");
  assert.equal(formatLei(5), "0,05 lei");
  assert.equal(formatLei(null), null);
  assert.equal(formatLei("abc"), null);
  assert.equal(formatDate("2026-10-05"), "05.10.2026");
  assert.equal(formatDate(null), null);
  assert.equal(daysLabel(10), "10 zile");
  assert.equal(daysLabel(19), "19 zile");
  assert.equal(daysLabel(30), "30 de zile");
  assert.equal(daysLabel(101), "101 zile");
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("full page: title, og tags, promos, announcements, links", () => {
  const out = renderOffersPage(MOCK_OFFERS, "hala");
  assert.match(out, /<title>Oferte Panviro Hala<\/title>/);
  assert.match(out, /<meta property="og:title" content="Oferte Panviro Hala" \/>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/tapselo.com\/og-image.jpg" \/>/);
  assert.match(out, /<meta property="og:description" content="Oferte la Panviro Hala: Cascaval Dalia &lt;b&gt;afumat&lt;\/b&gt; 39,99 lei, Paine alba feliata 4,99 lei, Rosii romanesti 9,90 lei\." \/>/);
  assert.match(out, /<link rel="canonical" href="https:\/\/tapselo.com\/o\/hala" \/>/);
  // promo card
  assert.match(out, /<s class="old"[^>]*>45,99 lei<\/s>/);
  // The struck price is the 30-day low (45,99), not the list price (49,99).
  assert.match(out, /<span class="new">39,99<\/span> <span class="unit">lei \/ kg<\/span>/);
  assert.match(out, /Cel mai mic pret in ultimele 30 de zile: 45,99 lei/);
  assert.match(out, /Cel mai mic pret in ultimele 10 zile: 6,50 lei/);
  assert.match(out, /Valabil pana pe 05\.10\.2026/);
  // prior line hidden when prior_lowest_cents is null; default emoji
  assert.doesNotMatch(out, /Cel mai mic pret in ultimele 10 zile: 12,00/);
  assert.match(out, /🏷️/);
  // announcement with line break
  assert.match(out, /Intre 10:00 si 13:00, la raionul de lactate\.<br \/>Va asteptam!/);
  assert.match(out, /Pana pe 04\.10\.2026/);
  // signup + privacy
  assert.match(out, /Vrei oferte pe email sau WhatsApp\?/);
  assert.match(out, /href="\/c\/hala"/);
  assert.match(out, /href="\/p\/hala"/);
  // footer company data
  assert.match(out, /Panviro &amp; Fiii SRL/);
  assert.match(out, /<a href="tel:0722123456">0722 123 456<\/a>/);
});

test("escapes hostile store and product text everywhere", () => {
  const p = clone();
  const evil = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;
  p.store.name = evil;
  p.store.company_name = evil;
  p.store.address = evil;
  p.store.phone = evil;
  p.promos![0].name = evil;
  p.promos![0].emoji = evil;
  p.promos![0].unit = evil;
  p.announcements![0].title = evil;
  p.announcements![0].body = evil;
  const out = renderOffersPage(p, "hala");
  assert.doesNotMatch(out, /<script>/);
  assert.doesNotMatch(out, /<img /);
  assert.doesNotMatch(out, /"><script/);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("signup link hidden when signup is off", () => {
  const p = clone();
  p.signup_enabled = false;
  const out = renderOffersPage(p, "hala");
  assert.doesNotMatch(out, /Vrei oferte pe email sau WhatsApp/);
  assert.doesNotMatch(out, /href="\/c\//);
  assert.match(out, /href="\/p\/hala"/);
});

test("empty page and description fallbacks", () => {
  const p = clone();
  p.promos = [];
  p.announcements = [];
  const out = renderOffersPage(p, "hala");
  assert.match(out, /Acum nu sunt oferte\. Revino in curand\./);
  assert.equal(offersDescription(p), "Ofertele de azi la Panviro Hala.");

  p.announcements = [{ title: "Program nou", body: null, ends_on: null }];
  assert.equal(offersDescription(p), "Panviro Hala: Program nou");

  const many = clone();
  many.promos = [...many.promos!, ...many.promos!];
  assert.match(offersDescription(many), / si inca 3\.$/);
});

test("no struck price when the promo is not lower", () => {
  const p = clone();
  p.promos = [{ ...p.promos![0], price_cents: 3999, promo_price_cents: 3999, prior_lowest_cents: 3999 }];
  const out = renderOffersPage(p, "hala");
  assert.doesNotMatch(out, /class="old"/);
});

test("not found page", () => {
  const out = renderNotFoundPage();
  assert.match(out, /<title>Pagina nu a fost gasita - Tapselo<\/title>/);
  assert.match(out, /Nu am gasit ofertele/);
});
