// Input rules for every generator (the SQL function checks them again).
// - text: trimmed, control characters removed, max 80 (names) / 120 (address) / 200 (descriptions)
// - no URLs in any text (phone numbers are fine)
// - numbers finite, 0 to 1,000,000; quantities 3 decimals, money 2 (half away from zero)
// - list sizes per kind, payload JSON max 32 KB
// The /g/{id} page runs the same validators on the stored payload, so a draft written
// around the tools (direct RPC call) still has to pass these rules to render.

import type {
  CashbookEntry,
  CashbookPayload,
  DraftKind,
  FlyerPayload,
  FlyerProduct,
  LabelProduct,
  LabelsPayload,
  NirLine,
  NirPayload,
  PayloadByKind,
  RecipeIngredient,
  RecipePayload,
} from "./types.ts";
import { DRAFT_KINDS } from "./types.ts";

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export const MAX_NAME = 80;
export const MAX_ADDRESS = 120;
export const MAX_DESCRIPTION = 200;
export const MAX_UNIT = 20;
export const MAX_NUMBER = 1_000_000;
export const MAX_PAYLOAD_BYTES = 32 * 1024;

export const MAX_ITEMS: Record<DraftKind, number> = { flyer: 24, labels: 60, nir: 40, recipe: 40, cashbook: 40 };

/** http, www., ://, or a domain like "magazin.ro" / "shop.com/x". */
export const URL_RE =
  /https?|www\.|:\/\/|\b[a-z0-9-]+\.(?:ro|com|net|org|eu|info|biz|io|shop|store|online|site|xyz|app)\b/i;

// Control characters, zero-width and bidi marks (by code point, so no invisible characters in the source).
function isControl(c: number): boolean {
  return c <= 0x1f || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff;
}

export function stripControl(s: string): string {
  let out = "";
  for (const ch of s) out += isControl(ch.codePointAt(0) ?? 0) ? " " : ch;
  return out;
}

export function containsUrl(s: string): boolean {
  return URL_RE.test(s);
}

/** Round half away from zero to `decimals` places (toPrecision drops float noise like 1.005*100). */
export function roundTo(x: number, decimals: number): number {
  const f = 10 ** decimals;
  const scaled = Number((Math.abs(x) * f).toPrecision(15));
  const r = (Math.sign(x) * Math.round(scaled)) / f;
  return r === 0 ? 0 : r;
}

export const roundMoney = (x: number): number => roundTo(x, 2);
export const roundQty = (x: number): number => roundTo(x, 3);

// ---------- field readers ----------

function isMissing(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Cleaned text, or undefined when optional and missing. */
export function text(v: unknown, field: string, max: number, required: true): string;
export function text(v: unknown, field: string, max: number, required?: false): string | undefined;
export function text(v: unknown, field: string, max: number, required = false): string | undefined {
  if (isMissing(v)) {
    if (required) throw new ValidationError(field, `Lipseste campul "${field}".`);
    return undefined;
  }
  if (typeof v !== "string" && typeof v !== "number") {
    throw new ValidationError(field, `Campul "${field}" trebuie sa fie text.`);
  }
  const s = stripControl(String(v)).replace(/\s+/g, " ").trim();
  if (s === "") {
    if (required) throw new ValidationError(field, `Lipseste campul "${field}".`);
    return undefined;
  }
  if (s.length > max) {
    throw new ValidationError(field, `Campul "${field}" are ${s.length} caractere; maximul este ${max}.`);
  }
  if (containsUrl(s)) {
    throw new ValidationError(field, `Campul "${field}" contine o adresa web. Linkurile nu sunt permise in documente.`);
  }
  return s;
}

/** Number in [min, MAX_NUMBER], rounded to `decimals`. Accepts "11,99" as well as 11.99. */
export function num(v: unknown, field: string, decimals: number, required: true, min?: number): number;
export function num(v: unknown, field: string, decimals: number, required?: false, min?: number): number | undefined;
export function num(v: unknown, field: string, decimals: number, required = false, min = 0): number | undefined {
  if (isMissing(v)) {
    if (required) throw new ValidationError(field, `Lipseste campul "${field}".`);
    return undefined;
  }
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) n = Number(v.trim().replace(",", "."));
  else throw new ValidationError(field, `Campul "${field}" trebuie sa fie un numar.`);
  if (!Number.isFinite(n)) throw new ValidationError(field, `Campul "${field}" trebuie sa fie un numar.`);
  const r = roundTo(n, decimals);
  if (r < min || r > MAX_NUMBER) {
    throw new ValidationError(field, `Campul "${field}" trebuie sa fie intre ${min} si ${MAX_NUMBER.toLocaleString("ro-RO")}.`);
  }
  return r;
}

export const money = (v: unknown, field: string, required = false) =>
  required ? num(v, field, 2, true) : num(v, field, 2, false);
export const qty = (v: unknown, field: string, required = false) =>
  required ? num(v, field, 3, true) : num(v, field, 3, false);

/** "2026-10-05" or "05.10.2026" -> "2026-10-05". */
export function date(v: unknown, field: string, required: true): string;
export function date(v: unknown, field: string, required?: false): string | undefined;
export function date(v: unknown, field: string, required = false): string | undefined {
  if (isMissing(v)) {
    if (required) throw new ValidationError(field, `Lipseste campul "${field}".`);
    return undefined;
  }
  const s = String(v).trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) [y, m, d] = [Number(r[3]), Number(r[2]), Number(r[1])];
  else throw new ValidationError(field, `Campul "${field}" trebuie sa fie o data (AAAA-LL-ZZ sau ZZ.LL.AAAA).`);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new ValidationError(field, `Campul "${field}" nu este o data valida.`);
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function phone(v: unknown, field: string): string | undefined {
  if (isMissing(v)) return undefined;
  const s = stripControl(String(v)).replace(/\s+/g, " ").trim();
  if (!/^[0-9+()\-./ ]{6,30}$/.test(s) || (s.match(/\d/g) ?? []).length < 6) {
    throw new ValidationError(field, `Campul "${field}" nu pare un numar de telefon.`);
  }
  return s;
}

export function list(v: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length === 0) {
    throw new ValidationError(field, `Campul "${field}" trebuie sa fie o lista cu cel putin un element.`);
  }
  if (v.length > max) throw new ValidationError(field, `Lista "${field}" are ${v.length} elemente; maximul este ${max}.`);
  return v;
}

function obj(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new ValidationError(field, `Elementul "${field}" trebuie sa fie un obiect.`);
  }
  return v as Record<string, unknown>;
}

/** Drops undefined values so optional fields stay out of the JSON. */
function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

export function payloadBytes(p: unknown): number {
  return new TextEncoder().encode(JSON.stringify(p)).length;
}

function checkSize<T>(p: T): T {
  const n = payloadBytes(p);
  if (n > MAX_PAYLOAD_BYTES) {
    throw new ValidationError("payload", `Documentul este prea mare (${Math.ceil(n / 1024)} KB; maximul este 32 KB). Imparte-l in doua.`);
  }
  return p;
}

// ---------- per kind ----------

export const THEMES = ["piata", "promo", "minimal"] as const;
export const VAT_RATES = [0, 5, 9, 11, 19, 21] as const;
export const LABEL_UNITS = ["g", "kg", "ml", "cl", "l", "buc"] as const;

function vatRate(v: unknown, field: string): number {
  const n = num(v, field, 2, true);
  if (!(VAT_RATES as readonly number[]).includes(n)) {
    throw new ValidationError(field, `Cota TVA din "${field}" trebuie sa fie una dintre: ${VAT_RATES.join(", ")}.`);
  }
  return n;
}

export function validateFlyer(raw: unknown): FlyerPayload {
  const a = obj(raw, "input");
  const theme = text(a.theme, "theme", MAX_UNIT) ?? "piata";
  if (!(THEMES as readonly string[]).includes(theme)) {
    throw new ValidationError("theme", `Tema trebuie sa fie una dintre: ${THEMES.join(", ")}.`);
  }
  const products = list(a.products, "products", MAX_ITEMS.flyer).map((p, i): FlyerProduct => {
    const o = obj(p, `products[${i}]`);
    const f = (k: string) => `products[${i}].${k}`;
    return compact({
      name: text(o.name, f("name"), MAX_NAME, true),
      price: money(o.price, f("price"), true) as number,
      promo_price: money(o.promo_price, f("promo_price")),
      unit: text(o.unit, f("unit"), MAX_UNIT) ?? "buc",
      prior_lowest_price: money(o.prior_lowest_price, f("prior_lowest_price")),
    });
  });
  return checkSize(
    compact({
      store_name: text(a.store_name, "store_name", MAX_NAME, true),
      phone: phone(a.phone, "phone"),
      address: text(a.address, "address", MAX_ADDRESS),
      theme,
      valid_until: date(a.valid_until, "valid_until"),
      products,
    }),
  );
}

export function validateLabels(raw: unknown): LabelsPayload {
  const a = obj(raw, "input");
  const products = list(a.products, "products", MAX_ITEMS.labels).map((p, i): LabelProduct => {
    const o = obj(p, `products[${i}]`);
    const f = (k: string) => `products[${i}].${k}`;
    const unitLabel = text(o.unit_label, f("unit_label"), MAX_UNIT)?.toLowerCase();
    if (unitLabel !== undefined && !(LABEL_UNITS as readonly string[]).includes(unitLabel)) {
      throw new ValidationError(f("unit_label"), `Campul "${f("unit_label")}" trebuie sa fie una dintre: ${LABEL_UNITS.join(", ")}.`);
    }
    let ean: string | undefined;
    if (!isMissing(o.ean)) {
      ean = String(o.ean).replace(/[\s-]/g, "");
      if (!/^(\d{8}|\d{13})$/.test(ean)) {
        throw new ValidationError(f("ean"), `Codul EAN din "${f("ean")}" trebuie sa aiba 8 sau 13 cifre.`);
      }
    }
    return compact({
      name: text(o.name, f("name"), MAX_NAME, true),
      price: money(o.price, f("price"), true) as number,
      unit: text(o.unit, f("unit"), MAX_UNIT) ?? "buc",
      unit_quantity: num(o.unit_quantity, f("unit_quantity"), 3, false, 0.001),
      unit_label: unitLabel,
      ean,
    });
  });
  return checkSize({ products });
}

export function validateNir(raw: unknown): NirPayload {
  const a = obj(raw, "input");
  const lines = list(a.lines, "lines", MAX_ITEMS.nir).map((l, i): NirLine => {
    const o = obj(l, `lines[${i}]`);
    const f = (k: string) => `lines[${i}].${k}`;
    return compact({
      name: text(o.name, f("name"), MAX_NAME, true),
      unit: text(o.unit, f("unit"), MAX_UNIT) ?? "buc",
      quantity: num(o.quantity, f("quantity"), 3, true, 0.001),
      unit_cost: money(o.unit_cost, f("unit_cost"), true) as number,
      vat_rate: vatRate(o.vat_rate, f("vat_rate")),
      sale_price: money(o.sale_price, f("sale_price")),
    });
  });
  return checkSize(
    compact({
      company: text(a.company, "company", MAX_NAME, true),
      supplier: text(a.supplier, "supplier", MAX_NAME, true),
      invoice_number: text(a.invoice_number, "invoice_number", MAX_NAME, true),
      invoice_date: date(a.invoice_date, "invoice_date", true),
      markup_percent: num(a.markup_percent, "markup_percent", 2),
      lines,
    }),
  );
}

export function validateRecipe(raw: unknown): RecipePayload {
  const a = obj(raw, "input");
  const ingredients = list(a.ingredients, "ingredients", MAX_ITEMS.recipe).map((g, i): RecipeIngredient => {
    const o = obj(g, `ingredients[${i}]`);
    const f = (k: string) => `ingredients[${i}].${k}`;
    let allergens: string[] | undefined;
    if (!isMissing(o.allergens)) {
      if (!Array.isArray(o.allergens) || o.allergens.length > 14) {
        throw new ValidationError(f("allergens"), `Campul "${f("allergens")}" trebuie sa fie o lista de cel mult 14 alergeni.`);
      }
      allergens = o.allergens
        .map((x, j) => text(x, `${f("allergens")}[${j}]`, 40))
        .filter((x): x is string => x !== undefined);
      if (allergens.length === 0) allergens = undefined;
    }
    return compact({
      name: text(o.name, f("name"), MAX_NAME, true),
      quantity: num(o.quantity, f("quantity"), 3, true, 0.001),
      unit: text(o.unit, f("unit"), MAX_UNIT) ?? "g",
      cost_per_unit: num(o.cost_per_unit, f("cost_per_unit"), 4),
      allergens,
    });
  });
  const portions = num(a.portions, "portions", 0, true, 1);
  return checkSize({
    name: text(a.name, "name", MAX_NAME, true),
    portions,
    ingredients,
  });
}

export function validateCashbook(raw: unknown): CashbookPayload {
  const a = obj(raw, "input");
  const entries = list(a.entries, "entries", MAX_ITEMS.cashbook).map((e, i): CashbookEntry => {
    const o = obj(e, `entries[${i}]`);
    const f = (k: string) => `entries[${i}].${k}`;
    const receipt = money(o.receipt, f("receipt"));
    const payment = money(o.payment, f("payment"));
    if (!receipt && !payment) {
      throw new ValidationError(f("receipt"), `Inregistrarea ${i + 1} trebuie sa aiba o incasare sau o plata mai mare ca zero.`);
    }
    return compact({
      doc: text(o.doc, f("doc"), MAX_NAME, true),
      description: text(o.description, f("description"), MAX_DESCRIPTION, true),
      receipt: receipt || undefined,
      payment: payment || undefined,
    });
  });
  return checkSize({
    company: text(a.company, "company", MAX_NAME, true),
    date: date(a.date, "date", true),
    opening_balance: money(a.opening_balance, "opening_balance", true) as number,
    entries,
  });
}

const VALIDATORS: { [K in DraftKind]: (raw: unknown) => PayloadByKind[K] } = {
  flyer: validateFlyer,
  labels: validateLabels,
  nir: validateNir,
  recipe: validateRecipe,
  cashbook: validateCashbook,
};

export function isDraftKind(k: unknown): k is DraftKind {
  return typeof k === "string" && (DRAFT_KINDS as readonly string[]).includes(k);
}

export function validatePayload<K extends DraftKind>(kind: K, raw: unknown): PayloadByKind[K] {
  return VALIDATORS[kind](raw);
}
