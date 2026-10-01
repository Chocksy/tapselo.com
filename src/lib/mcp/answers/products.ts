// lookup_products_by_ean: product facts from Open Food Facts (same API and fields family as
// pos/apps/admin/src/lib/services/openfoodfacts.ts). Data licence: ODbL, attribution in the answer.

import type { ToolDef, ToolEnv } from "../types.ts";
import { cell } from "../text.ts";
import { isValidEan } from "../../ean13.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";

const NAME = "lookup_products_by_ean";
const OFF_FIELDS = "product_name,product_name_ro,brands,quantity,image_url,nutriscore_grade";
const USER_AGENT = "Tapselo-AI-Plugin/1.0 (contact@tapselo.com)";
export const MAX_EANS = 30;
const CONCURRENCY = 5;

export interface ProductRow {
  ean: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  image_url: string | null;
  nutriscore: string | null;
  error?: string;
}

/** Splits input into unique valid EAN-8/EAN-13 codes and invalid ones. */
export function splitEans(input: unknown[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? "").replace(/[\s-]/g, "");
    if (isValidEan(s)) {
      if (!valid.includes(s)) valid.push(s);
    } else if (!invalid.includes(s)) {
      invalid.push(s.slice(0, 20));
    }
  }
  return { valid, invalid };
}

/** Runs fn over items with at most `limit` in flight; keeps input order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function fetchProduct(ean: string, env: Pick<ToolEnv, "fetch">): Promise<ProductRow> {
  const empty: ProductRow = { ean, found: false, name: null, brand: null, quantity: null, image_url: null, nutriscore: null };
  let res: Response;
  try {
    res = await env.fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}?fields=${OFF_FIELDS}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ...empty, error: "network" };
  }
  // Unknown products answer 404 with {"status":0}.
  if (res.status === 404) return empty;
  if (!res.ok) return { ...empty, error: `http_${res.status}` };
  let body: { status?: number; product?: Record<string, unknown> };
  try {
    body = await res.json();
  } catch {
    return { ...empty, error: "bad_json" };
  }
  const p = body.product;
  if (body.status !== 1 || !p) return empty;
  const image = s(p.image_url);
  return {
    ean,
    found: true,
    name: s(p.product_name_ro) ?? s(p.product_name),
    brand: s(p.brands),
    quantity: s(p.quantity),
    image_url: image && image.startsWith("https://") ? image : null,
    nutriscore: s(p.nutriscore_grade)?.toUpperCase() ?? null,
  };
}

export function productsMd(rows: ProductRow[], invalid: string[], url: string): string {
  const found = rows.filter((r) => r.found);
  const missing = rows.filter((r) => !r.found);
  const lines: string[] = [];
  if (found.length) {
    lines.push(
      "| EAN | Produs | Marca | Cantitate | Nutri-Score | Imagine |",
      "| --- | --- | --- | --- | --- | --- |",
      ...found.map(
        (r) =>
          `| ${r.ean} | ${cell(r.name ?? "-")} | ${cell(r.brand ?? "-")} | ${cell(r.quantity ?? "-")} | ${
            r.nutriscore && /^[A-E]$/.test(r.nutriscore) ? r.nutriscore : "-"
          } | ${r.image_url ? `[imagine](${r.image_url})` : "-"} |`,
      ),
    );
  } else {
    lines.push("Niciun produs gasit in Open Food Facts.");
  }
  if (missing.length) {
    const failed = missing.filter((r) => r.error);
    const notFound = missing.filter((r) => !r.error);
    if (notFound.length) lines.push("", `Negasite: ${notFound.map((r) => r.ean).join(", ")}`);
    if (failed.length) lines.push("", `Nu am putut verifica acum: ${failed.map((r) => r.ean).join(", ")}`);
  }
  if (invalid.length) lines.push("", `Coduri invalide (cifra de control gresita sau nu au 8/13 cifre): ${invalid.join(", ")}`);
  lines.push(
    "",
    "Date din Open Food Facts (openfoodfacts.org, licenta ODbL), completate de comunitate; verifica eticheta produsului.",
    `Pune produsele in casa de marcat Tapselo: ${url}`,
  );
  return lines.join("\n");
}

export function createProductsTool(): ToolDef {
  return {
    name: NAME,
    title: "Cauta produse dupa codul de bare (EAN)",
    description:
      "Look up products by barcode (cod de bare EAN-13 / EAN-8) in Open Food Facts: product name, brand, quantity " +
      "(gramaj), image link, Nutri-Score. Up to 30 codes at once, check digits validated. Useful to fill a product " +
      "list (nomenclator produse) for casa de marcat or etichete de raft.",
    inputSchema: {
      type: "object",
      properties: {
        eans: {
          type: "array",
          items: { type: "string", pattern: "^[0-9 -]{8,17}$" },
          minItems: 1,
          maxItems: MAX_EANS,
          description: "Coduri EAN-13 sau EAN-8, de ex. [\"5449000000996\"]",
        },
      },
      required: ["eans"],
      additionalProperties: false,
    },
    annotations: readOnly(true),
    async handler(args, env) {
      const { valid, invalid } = splitEans(args.eans as unknown[]);
      const url = trackedUrl("/", NAME);
      if (!valid.length) {
        return {
          text: `Niciun cod EAN valid. Verifica cifrele (EAN-13 are 13 cifre, EAN-8 are 8; ultima este cifra de control).\nInvalide: ${invalid.join(", ")}`,
          structured: { products: [], invalid },
          isError: true,
        };
      }
      const rows = await mapPool(valid, CONCURRENCY, (ean) => fetchProduct(ean, env));
      return { text: productsMd(rows, invalid, url), structured: { products: rows, invalid, url } };
    },
  };
}
