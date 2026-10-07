// Sample public_offers payload for local checks of /o/{slug}.
// Used by tests/offers-render.test.ts and by functions/o/[slug].ts with ?mock=1 on localhost only.
import type { OffersPayload } from "./offers-render.ts";

export const MOCK_OFFERS: OffersPayload = {
  store: {
    name: "Panviro Hala",
    slug: "hala",
    company_name: "Panviro & Fiii SRL",
    address: "Str. Gării 12, Brașov",
    phone: "0722 123 456",
    theme: "piata",
  },
  promos: [
    {
      product_id: "00000000-0000-0000-0000-000000000001",
      name: "Cașcaval Dalia <b>afumat</b>",
      emoji: "🧀",
      unit: "kg",
      price_cents: 4999,
      promo_price_cents: 3999,
      prior_lowest_cents: 4599,
      prior_days: 30,
      promo_to: "2026-10-05",
      image_url:
        "https://rhatutvdltsbhidghfhh.supabase.co/storage/v1/object/public/product-images/548c7199-fe0a-4844-bb4a-6fb47206992b/cfbe2390-1fec-45d7-910b-d9903816d27c/1790610409278.jpg",
    },
    {
      product_id: "00000000-0000-0000-0000-000000000002",
      name: "Pâine albă feliată",
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
      name: "Roșii românești",
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
      title: "Sâmbătă: degustare de brânzeturi",
      body: "Între 10:00 și 13:00, la raionul de lactate.\nVă așteptăm!",
      ends_on: "2026-10-04",
    },
    {
      title: "Struguri de Drăgășani",
      body: "Au sosit strugurii roșii de Drăgășani, direct de la producător.",
      ends_on: "2026-10-11",
      image_url:
        "https://rhatutvdltsbhidghfhh.supabase.co/storage/v1/object/public/product-images/548c7199-fe0a-4844-bb4a-6fb47206992b/announcements/da60277d-def6-4833-a0b0-5b034ab40d7a/1790612192213.jpg",
    },
  ],
  signup_enabled: true,
};
