// Run: npm test (node --test, native TypeScript type stripping, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCardPage, renderCardNotFound, levelLook, formatDay, formatPct, pointsLabel, TOKEN_RE, WALLET_PASS_URL, walletPassUrl, googleWalletUrl, type CardPayload } from "../src/lib/card-render.ts";
import { MOCK_CARD, MOCK_CARD_VARIANTS } from "../src/lib/card-mock.ts";
import { eanCheckDigit, isValidEan13 } from "../src/lib/ean13.ts";

const clone = (): CardPayload => structuredClone(MOCK_CARD);

test("token format", () => {
  assert.ok(TOKEN_RE.test("AAAAAAAAAAAAAAAAAAAAAA"));
  assert.ok(TOKEN_RE.test("aZ09_-aZ09_-aZ09_-aZ09"));
  for (const bad of ["", "x", "AAAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAAA=", "AAAAAAAAAAAAAAAAAAAA+/"]) {
    assert.equal(TOKEN_RE.test(bad), false, bad);
  }
});

test("card codes: '27' + 10 digits + check digit", () => {
  assert.equal(eanCheckDigit("270000001234"), 5);
  assert.ok(isValidEan13(MOCK_CARD.card_code));
  assert.equal(isValidEan13("2700000012346"), false);
});

test("helpers", () => {
  assert.equal(formatPct(3), "3");
  assert.equal(formatPct("2.5"), "2,5");
  assert.equal(formatPct(null), null);
  assert.equal(pointsLabel(1), "1 punct");
  assert.equal(pointsLabel(1100), "1100 de puncte");
  assert.equal(pointsLabel(19), "19 puncte");
  assert.equal(pointsLabel(101), "101 puncte");
  assert.equal(pointsLabel(0), "0 puncte");
  assert.deepEqual(levelLook("Argint"), levelLook("ARGINT"));
  assert.notDeepEqual(levelLook("Aur"), levelLook("Bronz"));
  assert.deepEqual(levelLook("Platina"), levelLook(null));
});

test("full card: shop, level label, barcode with digits, level box", () => {
  const out = renderCardPage(MOCK_CARD);
  assert.match(out, /<p class="shop">Magazin Test<\/p>/);
  assert.match(out, /<p class="lvl">Argint 3%<\/p>/);
  assert.match(out, /<p class="who">Razvan<\/p>/);
  assert.match(out, /aria-label="Cod de bare 2700000012345"/);
  const digits = [...out.matchAll(/<text [^>]*>(\d)<\/text>/g)].map((x) => x[1]).join("");
  assert.equal(digits, "2700000012345");
  assert.match(out, /<p class="pts">1100 de puncte<\/p>/);
  assert.match(out, /aria-valuenow="37"/);
  assert.match(out, /Inca 1900 de puncte pana la Aur \(5%\)/);
  assert.match(out, /Pastreaza linkul: adauga pagina pe ecranul principal/);
  assert.match(out, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /—/);
});

test("next percent is optional", () => {
  const p = clone();
  delete p.next_percent;
  assert.match(renderCardPage(p), /Inca 1900 de puncte pana la Aur<\/p>/);
});

test("top level and levels off", () => {
  const top = renderCardPage(MOCK_CARD_VARIANTS.top);
  assert.match(top, /Ai cel mai mare nivel/);
  assert.match(top, /aria-valuenow="100"/);
  assert.match(top, /<p class="lvl">Aur 5%<\/p>/);
  const off = renderCardPage(MOCK_CARD_VARIANTS.off);
  assert.match(off, /<p class="lvl">Card de client<\/p>/);
  assert.match(off, /aria-label="Cod de bare 2700000012345"/);
  assert.doesNotMatch(off, /class="box"/);
  assert.doesNotMatch(off, /puncte/);
});

test("invalid card code shows the digits without a barcode", () => {
  const p = clone();
  p.card_code = "2700000012346";
  const out = renderCardPage(p);
  assert.doesNotMatch(out, /<svg/);
  assert.match(out, /<p class="plain">2700000012346<\/p>/);
});

test("escapes hostile text everywhere", () => {
  const p = clone();
  const evil = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;
  p.shop_name = evil;
  p.first_name = evil;
  p.level_name = evil;
  p.next_name = evil;
  p.card_code = evil;
  const out = renderCardPage(p);
  assert.doesNotMatch(out, /<script>alert/);
  assert.doesNotMatch(out, /<img src=x/);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("Apple Wallet button: only for Apple devices, token encoded", () => {
  const token = "AbCdEfGhIjKlMnOpQrStUv";
  const apple = renderCardPage(MOCK_CARD, { token, isApple: true });
  assert.match(apple, new RegExp(`<a class="wallet" href="${WALLET_PASS_URL}\\?token=${token}">Adauga in Apple Wallet</a>`));
  // The button sits under the card, after the barcode panel.
  assert.ok(apple.indexOf('class="wallet"') > apple.indexOf('class="code"'));
  assert.doesNotMatch(renderCardPage(MOCK_CARD, { token, isApple: false }), /Apple Wallet/);
  assert.doesNotMatch(renderCardPage(MOCK_CARD, { token }), /Apple Wallet/);
  assert.doesNotMatch(renderCardPage(MOCK_CARD), /Apple Wallet/);
  assert.doesNotMatch(renderCardPage(MOCK_CARD, { isApple: true }), /Apple Wallet/);

  assert.equal(walletPassUrl("a+b/c&d=e"), `${WALLET_PASS_URL}?token=a%2Bb%2Fc%26d%3De`);
  const odd = renderCardPage(MOCK_CARD, { token: `x"&<y>`, isApple: true });
  assert.match(odd, /href="[^"]*\?token=x%22%26%3Cy%3E"/);
  assert.doesNotMatch(odd, /<y>/);
});

test("not found page", () => {
  const out = renderCardNotFound();
  assert.match(out, /Nu am gasit cardul/);
  assert.doesNotMatch(out, /<script/i);
});

test("Google Wallet button: only for Android, never with the Apple one", () => {
  const token = "AAAAAAAAAAAAAAAAAAAAAA";
  const android = renderCardPage(MOCK_CARD, { token, isAndroid: true });
  assert.ok(android.includes(`<a class="wallet" href="${WALLET_PASS_URL}?token=${token}&amp;platform=google">Adauga in Google Wallet</a>`));
  assert.doesNotMatch(android, /Apple Wallet/);
  assert.doesNotMatch(renderCardPage(MOCK_CARD, { token }), /Google Wallet/);
  assert.doesNotMatch(renderCardPage(MOCK_CARD, { isAndroid: true }), /Google Wallet/);
  assert.equal(googleWalletUrl("a+b"), `${WALLET_PASS_URL}?token=a%2Bb&platform=google`);
});

test("keep line: under the next line, escaped; none without data", () => {
  assert.equal(formatDay("2027-01-15"), "15 ian 2027");
  assert.equal(formatDay("2027-13-01"), "");
  assert.equal(formatDay(null), "");
  const out = renderCardPage({ ...clone(), keep_until: "2027-01-15", keep_points: 150 });
  assert.match(out, /<p class="keep">Mai ai <b>150 de puncte<\/b> pana pe 15 ian 2027 ca sa pastrezi Argint<\/p>/);
  assert.ok(out.indexOf('class="keep"') > out.indexOf('<p class="next">'));
  const odd = renderCardPage({ ...clone(), level_name: "<b>x</b>", keep_until: "2027-01-15", keep_points: 1 });
  assert.match(odd, /ca sa pastrezi &lt;b&gt;x&lt;\/b&gt;<\/p>/);
  assert.doesNotMatch(renderCardPage(clone()), /class="keep"/);
  assert.doesNotMatch(renderCardPage({ ...clone(), keep_until: "2027-01-15", keep_points: 0 }), /class="keep"/);
  assert.doesNotMatch(renderCardPage({ ...clone(), keep_until: "bad", keep_points: 10 }), /class="keep"/);
  assert.doesNotMatch(renderCardPage({ ...MOCK_CARD_VARIANTS.off, keep_until: "2027-01-15", keep_points: 10 }), /class="keep"/);
});
