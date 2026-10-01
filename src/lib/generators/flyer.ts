// Flyer with offers (kind "flyer"): the /o/{slug} offers look (renderOffersPage), without
// the signup block, plus the /g banner, print CSS and footer. Prices arrive in lei and are
// converted to the OffersPayload shape (cents).

import { renderOffersPage, safeImageUrl, type OffersPayload, type OfferPromo } from "../offers-render.ts";
import { SITE } from "../mcp/links.ts";
import type { DraftRecord, FlyerPayload } from "./types.ts";
import { bannerHtml, CHROME_CSS, footerHtml, SCRIPT_TAG } from "./page.ts";

const EMOJI: [RegExp, string][] = [
  [/\b(branz|telemea|cascaval|mozzarella|parmezan|cas\b|urda)/, "🧀"],
  [/\b(lapte|iaurt|kefir|sana|smantana)/, "🥛"],
  [/\b(paine|franzela|chifl|bagheta|cozonac)/, "🍞"],
  [/\b(croissant|corn\b|patiser)/, "🥐"],
  [/\b(cafea|espresso|nescafe|jacobs|lavazza|doncafe)/, "☕"],
  [/\b(ceai)/, "🍵"],
  [/\b(ou|oua)\b/, "🥚"],
  [/\b(pui|piept|pulp|aripi|curcan)/, "🍗"],
  [/\b(porc|vita|vitel|carne|ceafa|cotlet|muschi|tocat|miel)/, "🥩"],
  [/\b(carnat|carnati|salam|crenvursti|parizer|sunca|bacon|kaizer)/, "🌭"],
  [/\b(peste|somon|ton|pastrav|crap|macrou|hering|sardine)/, "🐟"],
  [/\b(rosii|tomate)/, "🍅"],
  [/\b(castrav)/, "🥒"],
  [/\b(ardei)/, "🫑"],
  [/\b(cartof)/, "🥔"],
  [/\b(ceapa|usturoi)/, "🧅"],
  [/\b(morcov)/, "🥕"],
  [/\b(mere|mar)\b/, "🍎"],
  [/\b(banane)/, "🍌"],
  [/\b(struguri)/, "🍇"],
  [/\b(portocal|mandarin|clementin|lamai)/, "🍊"],
  [/\b(ulei|masline)/, "🫒"],
  [/\b(vin)\b/, "🍷"],
  [/\b(bere)\b/, "🍺"],
  [/\b(apa)\b/, "💧"],
  [/\b(suc|nectar|cola|fanta|sprite)/, "🧃"],
  [/\b(ciocolat|bomboan|napolitan)/, "🍫"],
  [/\b(biscuit|prajitur|tort|fursec)/, "🍪"],
  [/\b(orez)\b/, "🍚"],
  [/\b(paste|spaghete|macaroane|fidea)/, "🍝"],
  [/\b(faina|malai|zahar|sare)\b/, "🌾"],
  [/\b(detergent|sapun|sampon|hartie)/, "🧴"],
];

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** A fitting emoji for a product name; 🛒 when nothing matches. */
export function emojiFor(name: string): string {
  const n = normalizeName(name);
  for (const [re, e] of EMOJI) if (re.test(n)) return e;
  return "🛒";
}

const cents = (lei: number | undefined): number | null =>
  lei === undefined || lei === null || !Number.isFinite(lei) ? null : Math.round(lei * 100);

/** The picture for product i, or null (emoji). Only "ready" pictures from our bucket. */
export function flyerImageUrl(draft: Pick<DraftRecord, "product_keys" | "images">, i: number): string | null {
  const key = draft.product_keys?.[i];
  if (!key) return null;
  const img = draft.images?.[key];
  if (!img || img.status !== "ready") return null;
  return safeImageUrl(img.url);
}

/** True while any product picture of this flyer is still being generated (short cache). */
export function hasPendingImages(draft: Pick<DraftRecord, "product_keys" | "images">): boolean {
  return (draft.product_keys ?? []).some((k) => !!k && draft.images?.[k]?.status === "pending");
}

/** FlyerPayload (lei) -> OffersPayload (cents) for renderOffersPage. */
export function flyerToOffers(p: FlyerPayload, draft: Pick<DraftRecord, "product_keys" | "images"> = {}): OffersPayload {
  const promos: OfferPromo[] = p.products.map((x, i) => {
    const hasPromo = x.promo_price !== undefined && x.promo_price !== null;
    const prior = hasPromo ? cents(x.prior_lowest_price) : null;
    return {
      product_id: `g-${i}`,
      name: x.name,
      emoji: emojiFor(x.name),
      unit: x.unit,
      price_cents: cents(x.price),
      promo_price_cents: hasPromo ? cents(x.promo_price) : cents(x.price),
      // The 30-day low is shown only when the user gave it; never invented.
      prior_lowest_cents: prior,
      prior_days: prior !== null ? 30 : null,
      promo_to: p.valid_until ?? null,
      image_url: flyerImageUrl(draft, i),
      // Without a given 30-day low, the struck price is the user's regular price, labelled as such.
      old_label: hasPromo && prior === null ? "Pret anterior" : null,
    };
  });
  return {
    store: {
      name: p.store_name,
      slug: null,
      company_name: p.store_name,
      address: p.address ?? null,
      phone: p.phone ?? null,
      theme: p.theme,
    },
    promos,
    announcements: [],
    signup_enabled: false,
  };
}

const FLYER_PRINT_CSS = `<style>${CHROME_CSS}
@media print{@page{size:A4;margin:8mm}
body{background:#fff}
.hero{padding:6mm 0 12mm}
.main{margin-top:-6mm;min-height:0;padding-bottom:0}
.wrap{max-width:none;padding:0 2mm}
.grid{grid-template-columns:repeat(3,1fr) !important;gap:3mm}
.promo{break-inside:avoid;box-shadow:none;border:1px solid #e2e8f0}
.art{height:24mm}
.ftr{padding:3mm 0 0}}
</style>`;

export function renderFlyer(p: FlyerPayload, draft: DraftRecord, id: string): string {
  return renderOffersPage(flyerToOffers(p, draft), id, {
    canonical: `${SITE}/g/${id}`,
    hideSignup: true,
    hidePrivacyLink: true,
    headExtra: FLYER_PRINT_CSS,
    bodyStart: bannerHtml("flyer"),
    bodyEnd: SCRIPT_TAG,
    made: footerHtml("flyer", draft.expires_at),
  });
}

/** Short Romanian summary for the tool answer. */
export function flyerSummary(p: FlyerPayload): string {
  const promos = p.products.filter((x) => x.promo_price !== undefined).length;
  return `Flyer pentru ${p.store_name}: ${p.products.length} produse${promos ? `, din care ${promos} la reducere` : ""}.`;
}
