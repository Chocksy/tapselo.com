// Generator tools for the MCP registry (src/lib/mcp/tools.ts imports `generatorTools`).
// Each handler validates, saves the draft with public_tool_create_draft, and answers in
// Romanian with a short summary and the tracked /g/{id} link.

import type { ToolDef, ToolEnv, ToolResult } from "../mcp/types.ts";
import { trackedUrl } from "../mcp/links.ts";
import type { DraftKind, PayloadByKind } from "./types.ts";
import { MAX_ADDRESS, MAX_DESCRIPTION, MAX_ITEMS, MAX_NAME, THEMES, VAT_RATES, LABEL_UNITS, ValidationError, validatePayload } from "./validate.ts";
import { ID_RE } from "./render.ts";
import { flyerSummary } from "./flyer.ts";
import { labelsSummary, unitPrice } from "./labels.ts";
import { nirSummary, nirTotals } from "./nir.ts";
import { recipeCalc, recipeSummary } from "./recipe.ts";
import { cashbookCalc, cashbookSummary } from "./cashbook.ts";
import { isValidEan } from "../ean13.ts";

export const MSG_SERVICE = "Serviciul de documente nu este disponibil acum. Încearcă din nou peste câteva minute.";

const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

function clean(msg: string): string {
  return msg.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300);
}

interface Spec<K extends DraftKind> {
  kind: K;
  tool: string;
  summary: (p: PayloadByKind[K]) => string;
  structured?: (p: PayloadByKind[K]) => Record<string, unknown>;
}

/** Validate -> RPC -> Romanian answer with the link. Exported for tests. */
export async function createDraft<K extends DraftKind>(spec: Spec<K>, args: Record<string, unknown>, env: ToolEnv): Promise<ToolResult> {
  let payload: PayloadByKind[K];
  try {
    payload = validatePayload(spec.kind, args);
  } catch (e) {
    if (e instanceof ValidationError) {
      return { isError: true, text: `Datele nu sunt bune: ${e.message} Corectează și încearcă din nou.`, structured: { field: e.field } };
    }
    throw e;
  }

  const res = await env.rpc<unknown>("public_tool_create_draft", { p_kind: spec.kind, p_payload: payload });
  if (!res.ok) {
    const text = res.kind === "rejected" && res.message ? `Nu am putut crea documentul: ${clean(res.message)}` : MSG_SERVICE;
    return { isError: true, text };
  }
  const raw = Array.isArray(res.data) ? res.data[0] : res.data;
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!ID_RE.test(id)) return { isError: true, text: MSG_SERVICE };

  const url = trackedUrl(`/g/${id}`, spec.tool);
  const text = [
    spec.summary(payload),
    "",
    `Documentul: ${url}`,
    "",
    "Pagina se printează sau se salvează ca PDF cu butonul „Printează / Salvează PDF”. Linkul expiră în 30 de zile.",
  ].join("\n");
  return { text, structured: { id, url, kind: spec.kind, ...(spec.structured?.(payload) ?? {}) } };
}

// ---------- JSON schemas ----------

const str = (maxLength: number, description: string) => ({ type: "string", maxLength, description });
const money = (description: string) => ({ type: "number", minimum: 0, maximum: 1_000_000, description });
const NO_URL = "Text with links or web addresses is rejected.";

const flyerSchema = {
  type: "object",
  properties: {
    store_name: str(MAX_NAME, "Numele magazinului"),
    phone: str(30, "Telefon (optional)"),
    address: str(MAX_ADDRESS, "Adresa (optional)"),
    theme: { type: "string", enum: [...THEMES], description: "piata (verde, implicit), promo (rosu), minimal" },
    valid_until: { type: "string", description: "Ofertele sunt valabile pana la (AAAA-LL-ZZ, optional)" },
    products: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS.flyer,
      items: {
        type: "object",
        properties: {
          name: str(MAX_NAME, "Produsul, ex. Telemea de vaca"),
          price: money("Pretul obisnuit, lei cu TVA"),
          promo_price: money("Pretul redus, lei (optional)"),
          unit: str(20, "kg, buc, l, 100 g ..."),
          prior_lowest_price: money("Cel mai mic pret din ultimele 30 de zile, lei (optional; nu il inventa)"),
        },
        required: ["name", "price", "unit"],
        additionalProperties: false,
      },
    },
  },
  required: ["store_name", "products"],
  additionalProperties: false,
};

const labelsSchema = {
  type: "object",
  properties: {
    products: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS.labels,
      items: {
        type: "object",
        properties: {
          name: str(MAX_NAME, "Produsul"),
          price: money("Pretul de vanzare, lei cu TVA"),
          unit: str(20, "Unitatea de vanzare: buc, kg, l"),
          unit_quantity: { type: "number", minimum: 0.001, maximum: 1_000_000, description: "Continutul unui produs, ex. 250 (pentru 250 g)" },
          unit_label: { type: "string", enum: [...LABEL_UNITS], description: "Unitatea continutului: g, kg, ml, cl, l, buc" },
          ean: { type: "string", pattern: "^[0-9 -]{8,17}$", description: "Cod de bare EAN-13 sau EAN-8 (optional)" },
        },
        required: ["name", "price", "unit"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
};

const nirSchema = {
  type: "object",
  properties: {
    company: str(MAX_NAME, "Firma care primeste marfa"),
    supplier: str(MAX_NAME, "Furnizorul"),
    invoice_number: str(MAX_NAME, "Numarul facturii"),
    invoice_date: { type: "string", description: "Data facturii (AAAA-LL-ZZ)" },
    markup_percent: { type: "number", minimum: 0, maximum: 1000, description: "Adaos comercial % aplicat liniilor fara sale_price (optional)" },
    lines: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS.nir,
      items: {
        type: "object",
        properties: {
          name: str(MAX_NAME, "Produsul"),
          unit: str(20, "UM: buc, kg, l ..."),
          quantity: { type: "number", minimum: 0.001, maximum: 1_000_000 },
          unit_cost: money("Pret unitar de achizitie FARA TVA, lei"),
          vat_rate: { type: "number", enum: [...VAT_RATES], description: "Cota TVA % de pe factura" },
          sale_price: money("Pret de vanzare unitar CU TVA, lei (optional)"),
        },
        required: ["name", "unit", "quantity", "unit_cost", "vat_rate"],
        additionalProperties: false,
      },
    },
  },
  required: ["company", "supplier", "invoice_number", "invoice_date", "lines"],
  additionalProperties: false,
};

const recipeSchema = {
  type: "object",
  properties: {
    name: str(MAX_NAME, "Numele produsului / retetei"),
    portions: { type: "integer", minimum: 1, maximum: 100000, description: "Numar de portii" },
    ingredients: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS.recipe,
      items: {
        type: "object",
        properties: {
          name: str(MAX_NAME, "Ingredientul"),
          quantity: { type: "number", minimum: 0.001, maximum: 1_000_000 },
          unit: str(20, "g, kg, ml, l, buc"),
          cost_per_unit: { type: "number", minimum: 0, maximum: 1_000_000, description: "Cost in lei pentru o unitate (aceeasi UM ca quantity), optional" },
          allergens: { type: "array", maxItems: 14, items: str(40, "ex. gluten, lapte, oua, nuci"), description: "Alergeni cunoscuti (optional)" },
        },
        required: ["name", "quantity", "unit"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "portions", "ingredients"],
  additionalProperties: false,
};

const cashbookSchema = {
  type: "object",
  properties: {
    company: str(MAX_NAME, "Firma"),
    date: { type: "string", description: "Ziua (AAAA-LL-ZZ)" },
    opening_balance: money("Soldul din ziua precedenta, lei"),
    entries: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS.cashbook,
      items: {
        type: "object",
        properties: {
          doc: str(MAX_NAME, "Documentul: raport Z, chitanta, dispozitie de plata ..."),
          description: str(MAX_DESCRIPTION, "Explicatia"),
          receipt: money("Incasare, lei"),
          payment: money("Plata, lei"),
        },
        required: ["doc", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["company", "date", "opening_balance", "entries"],
  additionalProperties: false,
};

// ---------- tools ----------

export const generatorTools: ToolDef[] = [
  {
    name: "create_offer_flyer",
    title: "Flyer cu oferte",
    description: `Create a printable A4 offer flyer (flyer cu oferte, promotii, pliant) for a shop in Romania from product names and prices in lei. Use when the user asks for an offer flyer, promo sheet or price list for their shop. Returns a link to a page on tapselo.com that prints or saves as PDF; it does not return an image. Max ${MAX_ITEMS.flyer} products. Prices in lei with VAT. ${NO_URL}`,
    inputSchema: flyerSchema,
    annotations: ANNOTATIONS,
    handler: (args, env) =>
      createDraft(
        {
          kind: "flyer",
          tool: "create_offer_flyer",
          summary: flyerSummary,
          structured: (p) => ({ products: p.products.length }),
        },
        args,
        env,
      ),
  },
  {
    name: "create_shelf_labels",
    title: "Etichete de raft",
    description: `Create printable shelf labels (etichete de raft, etichete pret), 21 per A4 page: name, price, the unit price per kg or litre required in Romania, and an EAN-13 barcode. Use when the user asks for shelf or price labels. Returns a link to a printable page on tapselo.com. Max ${MAX_ITEMS.labels} products. For the unit price send unit_quantity + unit_label (for example 250 + "g"). ${NO_URL}`,
    inputSchema: labelsSchema,
    annotations: ANNOTATIONS,
    handler: (args, env) =>
      createDraft(
        {
          kind: "labels",
          tool: "create_shelf_labels",
          summary: labelsSummary,
          structured: (p) => ({
            labels: p.products.length,
            without_unit_price: p.products.filter((x) => !unitPrice(x)).length,
            invalid_ean: p.products.filter((x) => x.ean && !isValidEan(x.ean)).length,
          }),
        },
        args,
        env,
      ),
  },
  {
    name: "create_nir",
    title: "NIR (nota de intrare-receptie)",
    description: `Create a printable goods received note (NIR, nota de intrare-receptie) from a supplier invoice: cost values, VAT, markup, sale value, totals and signatures. Use when the user asks for a NIR or to record received goods from an invoice. Returns a link to a printable page on tapselo.com. Max ${MAX_ITEMS.nir} lines. unit_cost is WITHOUT VAT; sale_price is WITH VAT. If the user gives a markup %, send markup_percent. ${NO_URL}`,
    inputSchema: nirSchema,
    annotations: ANNOTATIONS,
    handler: (args, env) =>
      createDraft(
        {
          kind: "nir",
          tool: "create_nir",
          summary: nirSummary,
          structured: (p) => {
            const t = nirTotals(p);
            return {
              lines: p.lines.length,
              cost_value: t.cost_value,
              cost_vat: t.cost_vat,
              cost_total: t.cost_total,
              sale_value: t.sale_value,
              markup_value: t.markup_value,
            };
          },
        },
        args,
        env,
      ),
  },
  {
    name: "create_recipe_sheet",
    title: "Fisa tehnica (reteta)",
    description: `Create a printable recipe sheet (fisa tehnica, reteta): ingredients, total cost and cost per portion, allergens (the 14 EU allergens, also detected from ingredient names; the operator confirms them). Use when the user asks for a recipe sheet, recipe costing or allergen list for a product they make. Returns a link to a printable page on tapselo.com. Max ${MAX_ITEMS.recipe} ingredients. ${NO_URL}`,
    inputSchema: recipeSchema,
    annotations: ANNOTATIONS,
    handler: (args, env) =>
      createDraft(
        {
          kind: "recipe",
          tool: "create_recipe_sheet",
          summary: recipeSummary,
          structured: (p) => {
            const c = recipeCalc(p);
            return { total_cost: c.total_cost, cost_per_portion: c.cost_per_portion, allergens: c.allergens };
          },
        },
        args,
        env,
      ),
  },
  {
    name: "create_cash_book",
    title: "Registru de casa",
    description: `Create a printable daily cash book (registru de casa) for a Romanian company: opening balance, receipts and payments with the balance after each, closing balance, and a warning above the 50,000 lei cash limit. Use when the user asks for a cash book or registru de casa for a day. Returns a link to a printable page on tapselo.com. Max ${MAX_ITEMS.cashbook} entries; each has receipt or payment. ${NO_URL}`,
    inputSchema: cashbookSchema,
    annotations: ANNOTATIONS,
    handler: (args, env) =>
      createDraft(
        {
          kind: "cashbook",
          tool: "create_cash_book",
          summary: cashbookSummary,
          structured: (p) => {
            const c = cashbookCalc(p);
            return { closing_balance: c.closing_balance, total_receipts: c.total_receipts, total_payments: c.total_payments, warnings: c.warnings };
          },
        },
        args,
        env,
      ),
  },
];
