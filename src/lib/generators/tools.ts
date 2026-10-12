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
import { parseCreateDraftRpc } from "./draft-rpc.ts";
import { retentionDaysForKind, retentionLabelForKind } from "./retention.ts";
import { PUBLIC_TOOL_ID_ENTROPY_BITS, PUBLIC_TOOL_ID_FORMAT } from "./id.ts";
import { FLYER_IMAGE_SOURCE, publicGeneratorDescription } from "./tool-copy.ts";

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
  const created = parseCreateDraftRpc(res.data);
  if (!created) return { isError: true, text: MSG_SERVICE };

  const { id, delete_secret: deleteSecret } = created;
  const url = trackedUrl(`/g/${id}`, spec.tool);
  const retention = retentionLabelForKind(spec.kind);
  const deleteUrl = deleteSecret ? `${url.split("?")[0]}?delete_secret=${encodeURIComponent(deleteSecret)}` : null;
  const deleteLines = deleteSecret
    ? [
        "",
        `Ștergere (păstrează secretul, nu îl partaja): cerere HTTP DELETE la adresa documentului cu antetul X-Delete-Secret: ${deleteSecret}`,
        `Sau deschide linkul de ștergere (aceeași adresă + secret): ${deleteUrl}`,
      ]
    : [];
  const text = [
    spec.summary(payload),
    "",
    `Documentul: ${url}`,
    `Identificator: ${id} (${PUBLIC_TOOL_ID_FORMAT})`,
    "",
    "Pagina este HTML printabil (nu returnează un fișier imagine).",
    "",
    `Pagina se printează sau se salvează ca PDF cu butonul „Printează / Salvează PDF”. Linkul expiră în ${retention}.`,
    ...deleteLines,
  ].join("\n");
  return {
    text,
    structured: {
      id,
      id_entropy_bits: PUBLIC_TOOL_ID_ENTROPY_BITS,
      url,
      delete_secret: deleteSecret,
      delete_url: deleteUrl,
      kind: spec.kind,
      retention_days: retentionDaysForKind(spec.kind),
      ...(spec.structured?.(payload) ?? {}),
    },
  };
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
    description: publicGeneratorDescription(
      `Creates a printable A4 offer flyer from product names and prices in lei (HTML on tapselo.com/g/{id}, not an image file). ` +
        `${FLYER_IMAGE_SOURCE} ` +
        `Max ${MAX_ITEMS.flyer} products. Prices in lei with VAT. ${NO_URL}`,
    ),
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
    description: publicGeneratorDescription(
      `Creates printable shelf labels (21 per A4): name, price, unit price per kg/l as required in Romania, and EAN-13 barcodes as SVG from src/lib/generators/labels.ts + src/lib/ean13.ts (no product photos). ` +
        `Max ${MAX_ITEMS.labels} products. For unit price send unit_quantity + unit_label (e.g. 250 + "g"). ${NO_URL}`,
    ),
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
    description: publicGeneratorDescription(
      `Creates a printable NIR from supplier invoice lines (cost, VAT, markup, totals). Public link expires in 7 days (sensitive purchase data). ` +
        `Max ${MAX_ITEMS.nir} lines. unit_cost WITHOUT VAT; sale_price WITH VAT. Optional markup_percent. ${NO_URL}`,
    ),
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
    description: publicGeneratorDescription(
      `Creates a printable recipe sheet: ingredients, cost per portion, allergens (14 EU allergens; operator confirms). ` +
        `Max ${MAX_ITEMS.recipe} ingredients. ${NO_URL}`,
    ),
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
    description: publicGeneratorDescription(
      `Creates a printable daily cash book (opening balance, receipts, payments, closing balance, 50,000 lei warning). ` +
        `Public link expires in 7 days (sensitive cash positions). Max ${MAX_ITEMS.cashbook} entries. ${NO_URL}`,
    ),
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
