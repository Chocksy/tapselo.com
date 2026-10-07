// Payloads the generator tools send to public_tool_create_draft(p_kind, p_payload),
// and the record public_tool_draft(p_id) returns. Money is lei with 2 decimals (not cents).
// Optional fields are left out of the JSON when not given.

export const DRAFT_KINDS = ["flyer", "labels", "nir", "recipe", "cashbook"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export interface FlyerProduct {
  name: string;
  /** Regular price, lei. */
  price: number;
  promo_price?: number;
  /** "kg", "buc", "l", ... */
  unit: string;
  /** Lowest price of the last 30 days, lei. Only shown when given. */
  prior_lowest_price?: number;
}

export interface FlyerPayload {
  store_name: string;
  phone?: string;
  address?: string;
  /** piata | promo | minimal */
  theme: string;
  /** YYYY-MM-DD */
  valid_until?: string;
  products: FlyerProduct[];
}

export interface LabelProduct {
  name: string;
  price: number;
  /** Selling unit: "buc", "kg", "l", ... */
  unit: string;
  /** Content of one item, e.g. 250 (with unit_label "g"). */
  unit_quantity?: number;
  /** g, kg, ml, cl, l, buc */
  unit_label?: string;
  /** Digits only, 8 or 13 long. Shown as a barcode only when the check digit is right. */
  ean?: string;
}

export interface LabelsPayload {
  products: LabelProduct[];
}

export interface NirLine {
  name: string;
  unit: string;
  quantity: number;
  /** Purchase price per unit without VAT, lei. */
  unit_cost: number;
  vat_rate: number;
  /** Sale price per unit with VAT, lei. */
  sale_price?: number;
  /** Quantity actually received; defaults to `quantity` (the invoice/aviz quantity). Values use this one. */
  quantity_received?: number;
}

export interface NirPayload {
  company: string;
  supplier: string;
  invoice_number: string;
  /** YYYY-MM-DD */
  invoice_date: string;
  markup_percent?: number;
  lines: NirLine[];
  /** NIR number and date (form 14-3-1A). Left as blanks to fill by hand when missing. */
  nir_number?: string;
  /** YYYY-MM-DD */
  nir_date?: string;
  /** Gestiunea (store / warehouse) */
  management?: string;
  company_tax_id?: string;
  supplier_tax_id?: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  /** Lei per one `unit`. */
  cost_per_unit?: number;
  allergens?: string[];
}

export interface RecipePayload {
  name: string;
  portions: number;
  ingredients: RecipeIngredient[];
}

export interface CashbookEntry {
  doc: string;
  /** "Nr. anexe" column of form 14-4-7A */
  annexes?: string;
  description: string;
  receipt?: number;
  payment?: number;
}

export interface CashbookPayload {
  company: string;
  /** YYYY-MM-DD */
  date: string;
  opening_balance: number;
  entries: CashbookEntry[];
}

export interface PayloadByKind {
  flyer: FlyerPayload;
  labels: LabelsPayload;
  nir: NirPayload;
  recipe: RecipePayload;
  cashbook: CashbookPayload;
}

export type ImageStatus = "pending" | "ready" | "failed" | "skipped";

/** What public_tool_draft(p_id) returns (null for unknown or expired ids). */
export interface DraftRecord {
  kind: string;
  payload: unknown;
  expires_at: string | null;
  /** Flyer only: subject key per payload.products index (null = no picture). */
  product_keys?: (string | null)[] | null;
  images?: Record<string, { status: ImageStatus | string; url: string | null } | null> | null;
}
