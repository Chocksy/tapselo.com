// Sample public_offers payload for local checks of /o/{slug}.
// Used by tests/offers-render.test.ts and by functions/o/[slug].ts with ?mock=1 on localhost only.
import type { OffersPayload } from "./offers-render.ts";

export const MOCK_OFFERS: OffersPayload = {
  store: {
    name: "Panviro Hala",
    slug: "hala",
    company_name: "Panviro & Fiii SRL",
    address: "Str. Garii 12, Brasov",
    phone: "0722 123 456",
  },
  promos: [
    {
      product_id: "00000000-0000-0000-0000-000000000001",
      name: "Cascaval Dalia <b>afumat</b>",
      emoji: "🧀",
      unit: "kg",
      price_cents: 4999,
      promo_price_cents: 3999,
      prior_lowest_cents: 4599,
      prior_days: 30,
      promo_to: "2026-10-05",
    },
    {
      product_id: "00000000-0000-0000-0000-000000000002",
      name: "Paine alba feliata",
      emoji: "🍞",
      unit: "buc",
      price_cents: 650,
      promo_price_cents: 499,
      prior_lowest_cents: 650,
      prior_days: 10,
      promo_to: "2026-09-30",
    },
    {
      product_id: "00000000-0000-0000-0000-000000000003",
      name: "Rosii romanesti",
      emoji: null,
      unit: "kg",
      price_cents: 1200,
      promo_price_cents: 990,
      prior_lowest_cents: null,
      prior_days: 10,
      promo_to: null,
    },
  ],
  announcements: [
    {
      title: "Sambata: degustare de branzeturi",
      body: "Intre 10:00 si 13:00, la raionul de lactate.\nVa asteptam!",
      ends_on: "2026-10-04",
    },
  ],
  signup_enabled: true,
};
