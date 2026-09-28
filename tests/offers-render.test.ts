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
  safeImageUrl,
  themeOf,
  IMAGE_URL_PREFIX,
  IMAGE_NOTE,
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
  assert.match(out, /<p class="old"><s[^>]*>45,99 lei<\/s><\/p>/);
  // The struck price is the 30-day low (45,99), not the list price (49,99).
  assert.match(out, /<p class="tag"><span class="new">39,99<\/span><span class="unit">lei \/ kg<\/span><\/p>/);
  assert.match(out, /Cel mai mic pret in ultimele 30 de zile: 45,99 lei/);
  assert.match(out, /Cel mai mic pret in ultimele 10 zile: 6,50 lei/);
  assert.match(out, /<p class="valid">Pana pe 05\.10\.2026<\/p>/);
  // prior line hidden when prior_lowest_cents is null; default emoji
  assert.doesNotMatch(out, /Cel mai mic pret in ultimele 10 zile: 12,00/);
  assert.match(out, /🏷️/);
  // announcement with line break
  assert.match(out, /Intre 10:00 si 13:00, la raionul de lactate\.<br \/>Va asteptam!/);
  assert.match(out, /<span class="until">Pana pe 04\.10\.2026<\/span>/);
  assert.match(out, /📣/);
  assert.match(out, /<p class="kicker">Ofertele de azi<\/p>/);
  assert.match(out, /<h1>Oferte<\/h1>/);
  assert.match(out, /Preturi mici la produsele de mai jos, doar in magazin\./);
  assert.match(out, /<meta name="theme-color" content="#14532d" \/>/);
  assert.match(out, /family=Geist:wght@400\.\.900/);
  // signup + privacy
  assert.match(out, /Vrei ofertele pe email sau WhatsApp\?/);
  assert.match(out, /Te anuntam cand apar preturi noi\./);
  assert.match(out, /<a class="btn" href="\/c\/hala">Inscrie-te<\/a>/);
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
  p.promos![0].image_url = evil;
  p.announcements![1].image_url = evil;
  p.store.theme = evil;
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
  assert.doesNotMatch(out, /Vrei ofertele pe email sau WhatsApp/);
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
  assert.doesNotMatch(out, /class="badge"/);
});

test("percent badge uses the prior lowest price, only with an old price", () => {
  const out = renderOffersPage(MOCK_OFFERS, "hala");
  // Cascaval: ref = prior_lowest 4599 (not price 4999), promo 3999 -> floor(13.04) = 13.
  assert.match(out, /<img [^>]*\/><span class="badge">-13%<\/span>/);
  assert.doesNotMatch(out, /-20%/);

  const p = clone();
  p.promos = [{ ...p.promos![1], price_cents: null, prior_lowest_cents: null }];
  const none = renderOffersPage(p, "hala");
  assert.doesNotMatch(none, /class="old"/);
  assert.doesNotMatch(none, /class="badge"/);
});

test("not found page", () => {
  const out = renderNotFoundPage();
  assert.match(out, /<title>Pagina nu a fost gasita - Tapselo<\/title>/);
  assert.match(out, /<header class="hero">/);
  assert.match(out, /<h1 class="h1-sm">Nu am gasit ofertele<\/h1>/);
  assert.match(out, /Magazinul nu are o pagina de oferte activa/);
});

test("theme: body data-theme, theme-color, fallback to piata", () => {
  const p = clone();
  assert.match(renderOffersPage(p, "hala"), /<body data-theme="piata">/);
  p.store.theme = "promo";
  let out = renderOffersPage(p, "hala");
  assert.match(out, /<body data-theme="promo">/);
  assert.match(out, /<meta name="theme-color" content="#dc2626" \/>/);
  p.store.theme = "minimal";
  out = renderOffersPage(p, "hala");
  assert.match(out, /<body data-theme="minimal">/);
  assert.match(out, /<meta name="theme-color" content="#faf7f0" \/>/);
  for (const bad of [null, undefined, "", "neon", "PROMO", `"><script>`]) {
    p.store.theme = bad as string | null;
    assert.equal(themeOf(p), "piata");
    assert.match(renderOffersPage(p, "hala"), /<body data-theme="piata">/);
  }
  assert.equal(themeOf(null), "piata");
  assert.match(renderNotFoundPage(), /<body data-theme="piata">/);
});

test("images: only our bucket, escaped, emoji fallback, footer note", () => {
  const good = `${IMAGE_URL_PREFIX}548c7199-fe0a-4844-bb4a-6fb47206992b/cfbe2390-1fec-45d7-910b-d9903816d27c/1790610409278.jpg`;
  assert.equal(safeImageUrl(good), good);
  for (const bad of [
    null,
    123,
    "",
    "https://evil.example/x.jpg",
    "http://rhatutvdltsbhidghfhh.supabase.co/storage/v1/object/public/product-images/a.jpg",
    "https://rhatutvdltsbhidghfhh.supabase.co/storage/v1/object/public/order-photos/a.jpg",
    `${IMAGE_URL_PREFIX}a.jpg" onerror="alert(1)`,
    `${IMAGE_URL_PREFIX}../order-photos/a.jpg`,
    `${IMAGE_URL_PREFIX}a/b.jpg?x=<y>`,
    `${IMAGE_URL_PREFIX}`,
    `javascript:alert(1)//${IMAGE_URL_PREFIX}`,
  ]) {
    assert.equal(safeImageUrl(bad), null, String(bad));
  }

  const out = renderOffersPage(MOCK_OFFERS, "hala");
  assert.match(out, new RegExp(`<div class="art has-img" aria-hidden="true"><img src="${good.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" alt="" loading="lazy"`));
  assert.equal((out.match(/<img /g) ?? []).length, 2);
  // announcement picture: its own card layout, megaphone only on the plain one
  const annUrl = MOCK_OFFERS.announcements![1].image_url!;
  assert.match(out, new RegExp(`<article class="ann has-img">\n<div class="ann-img" aria-hidden="true"><img src="${annUrl.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" alt=""`));
  assert.equal((out.match(/📣/g) ?? []).length, 1);
  assert.match(out, /🍞/);
  assert.match(out, new RegExp(`<p class="img-note">${IMAGE_NOTE.replace(/\./g, "\\.")}</p>`));
  assert.equal(IMAGE_NOTE, "Imaginile produselor sunt cu titlu de prezentare.");

  const p = clone();
  p.promos![0].image_url = `${IMAGE_URL_PREFIX}x.jpg" onerror="alert(1)`;
  p.announcements![1].image_url = "https://evil.example/x.jpg";
  const bad = renderOffersPage(p, "hala");
  assert.doesNotMatch(bad, /<img /);
  assert.doesNotMatch(bad, /onerror/);
  assert.match(bad, /🧀<span class="badge">-13%<\/span>/);
  assert.doesNotMatch(bad, /class="img-note"/);
  assert.doesNotMatch(bad, /evil\.example/);
  assert.doesNotMatch(bad, /class="ann has-img"/);
  assert.equal((bad.match(/📣/g) ?? []).length, 2);

  // an announcement picture alone still shows the footer note
  const q = clone();
  q.promos!.forEach((x) => (x.image_url = null));
  assert.match(renderOffersPage(q, "hala"), /class="img-note"/);
});
