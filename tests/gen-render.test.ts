import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { renderDraft } from "../src/lib/generators/render.ts";
import { MOCK_DRAFTS } from "../src/lib/generators/mock.ts";
import { PRINT_SCRIPT, PRINT_SCRIPT_HASH, renderGeneratedNotFound } from "../src/lib/generators/page.ts";
import { emojiFor, flyerImageUrl, flyerToOffers, hasPendingImages } from "../src/lib/generators/flyer.ts";
import { ALLERGEN_NOTE } from "../src/lib/generators/recipe.ts";
import { IMAGE_URL_PREFIX } from "../src/lib/offers-render.ts";
import type { DraftKind, DraftRecord } from "../src/lib/generators/types.ts";

const ID = "Ab3dEf7hJk";
const KINDS: DraftKind[] = ["flyer", "labels", "nir", "recipe", "cashbook"];
const clone = (k: DraftKind): DraftRecord & { payload: any } => structuredClone(MOCK_DRAFTS[k]) as DraftRecord & { payload: any };
const EVIL = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;

test("CSP hash matches the inline print script", () => {
  const h = createHash("sha256").update(PRINT_SCRIPT).digest("base64");
  assert.equal(PRINT_SCRIPT_HASH, `sha256-${h}`);
});

test("every kind renders the shell: noindex, banner, print button, script, footer, expiry", () => {
  for (const k of KINDS) {
    const r = renderDraft(MOCK_DRAFTS[k], ID);
    assert.equal(r.status, 200, k);
    const out = r.html;
    assert.match(out, /<meta name="robots" content="noindex/, k);
    assert.match(out, /Document creat gratuit cu Tapselo, casa de marcat pentru magazine mici\./, k);
    assert.match(out, new RegExp(`<a href="https://tapselo\\.com/\\?utm_source=ai-plugin&amp;utm_medium=mcp&amp;utm_campaign=g_${k}">Afla mai mult</a>`), k);
    assert.match(out, /<button type="button" id="print-btn" class="g-print">Printeaza \/ Salveaza PDF<\/button>/, k);
    assert.equal(out.split("<script>").length - 1, 1, k);
    assert.ok(out.includes(`<script>${PRINT_SCRIPT}</script>`), k);
    assert.match(out, /Generat cu <a [^>]*>tapselo\.com<\/a>/, k);
    assert.match(out, /<p class="g-abuse no-print">Pagina creata de un utilizator\. Expira pe 31\.10\.2026\. Raporteaza abuz: <a href="mailto:contact@tapselo\.com">contact@tapselo\.com<\/a><\/p>/, k);
    assert.match(out, /@page\{size:A4/, k);
    assert.match(out, /\.no-print\{display:none !important\}/, k);
    assert.doesNotMatch(out, /Inscrie-te|Cum folosim datele clientilor/, k);
  }
});

test("every renderer escapes hostile text", () => {
  const evil: Record<DraftKind, (d: any) => void> = {
    flyer: (d) => {
      d.payload.store_name = EVIL.slice(0, 80);
      d.payload.address = EVIL;
      d.payload.products[0].name = EVIL;
      d.payload.products[0].unit = "<blink>kg";
      d.images["telemea de vaca"].url = `${IMAGE_URL_PREFIX}x.jpg" onerror="alert(1)`;
    },
    labels: (d) => {
      d.payload.products[0].name = EVIL;
      d.payload.products[0].unit = "<blink>";
    },
    nir: (d) => {
      d.payload.company = EVIL;
      d.payload.supplier = EVIL;
      d.payload.invoice_number = EVIL;
      d.payload.lines[0].name = EVIL;
      d.payload.lines[0].unit = "<blink>";
    },
    recipe: (d) => {
      d.payload.name = EVIL;
      d.payload.ingredients[0].name = EVIL;
      d.payload.ingredients[5].allergens = [EVIL.slice(0, 40)];
    },
    cashbook: (d) => {
      d.payload.company = EVIL;
      d.payload.entries[0].doc = EVIL;
      d.payload.entries[0].description = EVIL;
    },
  };
  for (const k of KINDS) {
    const d = clone(k);
    evil[k](d);
    const r = renderDraft(d, ID);
    assert.equal(r.status, 200, k);
    assert.doesNotMatch(r.html, /<script>alert/, k);
    assert.doesNotMatch(r.html, /<img src=x/, k);
    assert.doesNotMatch(r.html, /onerror="/, k);
    assert.doesNotMatch(r.html, /<blink>/, k);
    assert.match(r.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, k);
  }
});

test("payload with a URL or a bad kind renders the not-found page", () => {
  const d = clone("nir");
  d.payload.supplier = "Vezi www.evil";
  assert.equal(renderDraft(d, ID).status, 404);
  assert.equal(renderDraft({ ...clone("nir"), kind: "nope" }, ID).status, 404);
  assert.equal(renderDraft(null, ID).status, 404);
  assert.equal(renderDraft(MOCK_DRAFTS.nir, "short").status, 404);
  assert.match(renderGeneratedNotFound(), /Documentul nu a fost gasit/);
  assert.equal(renderDraft(null, ID).maxAge, 60);
});

test("flyer: offers look, emoji only (no AI pictures), prices, cache", () => {
  const r = renderDraft(MOCK_DRAFTS.flyer, ID);
  const out = r.html;
  assert.equal(r.maxAge, 600);
  assert.match(out, /<link rel="canonical" href="https:\/\/tapselo\.com\/g\/Ab3dEf7hJk" \/>/);
  assert.match(out, /<title>Oferte Alimentara La Doi Pasi<\/title>/);
  assert.equal((out.match(/<img /g) ?? []).length, 0); // even with a "ready" picture stored
  for (const p of (MOCK_DRAFTS.flyer.payload as any).products) assert.ok(out.includes(emojiFor(p.name)), p.name);
  assert.match(out, /🧀/); // telemea: ready picture ignored -> emoji
  assert.match(out, /☕/);
  assert.match(out, /🍞/);
  assert.match(out, /🍅/);
  assert.match(out, /🫒/);
  // Telemea 32 -> 27, no 30-day low given: struck regular price labelled "Pret anterior", no 30-day line
  assert.match(out, /<p class="old">Pret anterior: <s[^>]*>32,00 lei<\/s><\/p>/);
  assert.match(out, /<span class="new">27,00<\/span><span class="unit">lei \/ kg<\/span>/);
  // Cafea: 30-day low given -> struck 21,50 and the legal line
  assert.match(out, /<p class="old"><s[^>]*>21,50 lei<\/s><\/p>/);
  assert.match(out, /Cel mai mic pret in ultimele 30 de zile: 21,50 lei/);
  assert.equal((out.match(/Cel mai mic pret/g) ?? []).length, 1);
  // no promo: plain price, no struck price
  assert.match(out, /<h3>Paine alba feliata<\/h3>\n\n<p class="tag"><span class="new">6,50<\/span>/);
  assert.match(out, /Pana pe 12\.10\.2026/);
  assert.match(out, /<a href="tel:0722123456">0722 123 456<\/a>/);

  const done = clone("flyer");
  done.images!["cafea jacobs"] = { status: "ready", url: `${IMAGE_URL_PREFIX}public/abc.jpg` };
  assert.equal(hasPendingImages(MOCK_DRAFTS.flyer), true);
  assert.equal(hasPendingImages(done), false);
  assert.equal(renderDraft(done, ID).maxAge, 600);
  assert.equal(flyerImageUrl(done, 1), `${IMAGE_URL_PREFIX}public/abc.jpg`);
  done.images!["cafea jacobs"] = { status: "ready", url: "https://evil.example/a.jpg" };
  assert.equal(flyerImageUrl(done, 1), null);
  assert.equal(flyerImageUrl({}, 0), null);

  assert.equal(emojiFor("Telemea de vaca"), "🧀");
  assert.equal(emojiFor("Șuruburi"), "🛒");
  const o = flyerToOffers(MOCK_DRAFTS.flyer.payload as any);
  assert.equal(o.promos![0].price_cents, 3200);
  assert.equal(o.promos![0].promo_price_cents, 2700);
  assert.equal(o.promos![2].promo_price_cents, 650);
  assert.equal(o.signup_enabled, false);
});

test("labels: big price, unit price, barcode only for a valid EAN-13", () => {
  const out = renderDraft(MOCK_DRAFTS.labels, ID).html;
  assert.equal((out.match(/<article class="lbl">/g) ?? []).length, 5);
  assert.match(out, /<b>11<\/b><sup>,99<\/sup><span>lei \/ buc<\/span>/);
  assert.match(out, /Pret unitar: <b>88,00 lei \/ kg<\/b>/);
  assert.match(out, /Pret unitar: <b>32,00 lei \/ kg<\/b>/);
  assert.match(out, /Pret unitar: \.+ lei \/ kg/); // biscuiti, no quantity
  assert.equal((out.match(/<svg class="ean"/g) ?? []).length, 1); // only 5901234123457
  assert.match(out, /aria-label="Cod de bare 5901234123457"/);
  assert.match(out, /<p class="ean">EAN 5941234567890<\/p>/); // invalid: digits, no bars
  assert.match(out, /<p class="ean">EAN 96385074<\/p>/); // EAN-8: digits
  assert.equal(renderDraft(MOCK_DRAFTS.labels, ID).maxAge, 600);
});

test("NIR: landscape, totals, signatures", () => {
  const out = renderDraft(MOCK_DRAFTS.nir, ID).html;
  assert.match(out, /@page\{size:A4 landscape/);
  assert.match(out, /Nota de intrare-receptie/);
  assert.match(out, /<td colspan="5">TOTAL<\/td><td class="num">482,20<\/td><td><\/td><td class="num">57,31<\/td>/);
  assert.match(out, /<td class="num">687,83<\/td><\/tr>\n<\/tfoot>/);
  assert.match(out, /Comisia de receptie/);
  assert.match(out, /Gestionar/);
});

test("recipe: cost per portion and the allergen note", () => {
  const out = renderDraft(MOCK_DRAFTS.recipe, ID).html;
  assert.match(out, /Cost pe portie: <b>2,11 lei<\/b>/);
  assert.ok(out.includes(ALLERGEN_NOTE));
  assert.equal(ALLERGEN_NOTE, "Alergenii trebuie confirmati de operator.");
  for (const a of ["Cereale care contin gluten", "Oua", "Lapte (inclusiv lactoza)", "Seminte de susan"]) assert.ok(out.includes(`<li>${a}</li>`), a);
});

test("cash book: balances and the 50,000 lei warning", () => {
  const out = renderDraft(MOCK_DRAFTS.cashbook, ID).html;
  assert.match(out, /Sold din ziua precedenta/);
  assert.match(out, /<td class="num">6\.070,55<\/td>/);
  assert.match(out, /Sold final<\/td><td><\/td><td><\/td><td class="num">1\.950,55<\/td>/);
  assert.doesNotMatch(out, /class="warn"/);
  const d = clone("cashbook");
  d.payload.opening_balance = 60000;
  assert.match(renderDraft(d, ID).html, /<p class="warn">Soldul final \(60\.700,15 lei\) depaseste plafonul de casa de 50\.000,00 lei/);
});
