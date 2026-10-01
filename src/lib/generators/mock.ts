// Sample public_tool_draft records for local checks of /g/{id} (?mock=<kind> on localhost only)
// and for tests/gen-*.test.ts.
import type { DraftKind, DraftRecord } from "./types.ts";

const EXPIRES = "2026-10-31T10:00:00+00:00";
const IMG =
  "https://rhatutvdltsbhidghfhh.supabase.co/storage/v1/object/public/product-images/548c7199-fe0a-4844-bb4a-6fb47206992b/cfbe2390-1fec-45d7-910b-d9903816d27c/1790610409278.jpg";

export const MOCK_DRAFTS: Record<DraftKind, DraftRecord> = {
  flyer: {
    kind: "flyer",
    expires_at: EXPIRES,
    payload: {
      store_name: "Alimentara La Doi Pasi",
      phone: "0722 123 456",
      address: "Str. Garii 12, Brasov",
      theme: "piata",
      valid_until: "2026-10-12",
      products: [
        { name: "Telemea de vaca", price: 32, promo_price: 27, unit: "kg" },
        { name: "Cafea Jacobs 250g", price: 22, promo_price: 18, unit: "buc", prior_lowest_price: 21.5 },
        { name: "Paine alba feliata", price: 6.5, unit: "buc" },
        { name: "Rosii romanesti", price: 12, promo_price: 9.9, unit: "kg" },
        { name: "Ulei Floriol 1L", price: 11.99, unit: "buc" },
      ],
    },
    product_keys: ["telemea de vaca", "cafea jacobs", "paine alba feliata", "rosii romanesti", null],
    images: {
      "telemea de vaca": { status: "ready", url: IMG },
      "cafea jacobs": { status: "pending", url: null },
      "paine alba feliata": { status: "skipped", url: null },
      "rosii romanesti": { status: "failed", url: null },
    },
  },
  labels: {
    kind: "labels",
    expires_at: EXPIRES,
    payload: {
      products: [
        { name: "Ulei Floriol 1L", price: 11.99, unit: "buc", unit_quantity: 1, unit_label: "l", ean: "5941234567890" },
        { name: "Cafea Jacobs Kronung", price: 22, unit: "buc", unit_quantity: 250, unit_label: "g", ean: "5901234123457" },
        { name: "Telemea de vaca", price: 32, unit: "kg" },
        { name: "Oua M (10 buc)", price: 9.5, unit: "buc", unit_quantity: 10, unit_label: "buc", ean: "96385074" },
        { name: "Biscuiti cu unt", price: 4.2, unit: "buc" },
      ],
    },
  },
  nir: {
    kind: "nir",
    expires_at: EXPIRES,
    payload: {
      company: "Panviro & Fiii SRL",
      supplier: "Lactate Brasov SA",
      invoice_number: "LB 004512",
      invoice_date: "2026-09-30",
      markup_percent: 25,
      lines: [
        { name: "Telemea de vaca", unit: "kg", quantity: 12.5, unit_cost: 24.8, vat_rate: 11 },
        { name: "Lapte 3,5% 1L", unit: "buc", quantity: 24, unit_cost: 5.4, vat_rate: 11 },
        { name: "Detergent vase 500ml", unit: "buc", quantity: 6, unit_cost: 7.1, vat_rate: 21, sale_price: 12.99 },
      ],
    },
  },
  recipe: {
    kind: "recipe",
    expires_at: EXPIRES,
    payload: {
      name: "Placinta cu branza",
      portions: 8,
      ingredients: [
        { name: "Faina alba 000", quantity: 0.5, unit: "kg", cost_per_unit: 4.2 },
        { name: "Branza de vaci", quantity: 0.4, unit: "kg", cost_per_unit: 18 },
        { name: "Oua", quantity: 3, unit: "buc", cost_per_unit: 0.9 },
        { name: "Unt", quantity: 0.1, unit: "kg", cost_per_unit: 45 },
        { name: "Zahar", quantity: 0.08, unit: "kg", cost_per_unit: 5 },
        { name: "Seminte", quantity: 0.01, unit: "kg", allergens: ["susan"] },
      ],
    },
  },
  cashbook: {
    kind: "cashbook",
    expires_at: EXPIRES,
    payload: {
      company: "Panviro & Fiii SRL",
      date: "2026-09-30",
      opening_balance: 1250.4,
      entries: [
        { doc: "Z 0412", description: "Incasari din vanzari, raport Z", receipt: 4820.15 },
        { doc: "DP 18", description: "Plata furnizor Lactate Brasov", payment: 1120 },
        { doc: "DP 19", description: "Depunere numerar la banca", payment: 3000 },
      ],
    },
  },
};
