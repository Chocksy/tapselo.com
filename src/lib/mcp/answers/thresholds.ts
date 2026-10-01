// check_tax_thresholds: distance to the VAT exemption threshold (395.000 lei) and to the
// micro-enterprise ceiling (100.000 EUR at the BNR rate).
// BNR moved the XML: www.bnr.ro/nbrfxrates.xml answers 404 (checked 2026-10-01); curs.bnr.ro serves it.

import type { ToolDef, ToolEnv } from "../types.ts";
import { formatDateRo, formatLei, formatNumber, formatPercent } from "../text.ts";
import { trackedUrl } from "../links.ts";
import { readOnly } from "./kb.ts";

const NAME = "check_tax_thresholds";
export const BNR_URL = "https://curs.bnr.ro/nbrfxrates.xml";
export const VAT_THRESHOLD_LEI = 395000;
export const MICRO_CEILING_EUR = 100000;
const CACHE_KEY = "https://tapselo.com/__cache/bnr-eur-v1";
const CACHE_SECONDS = 6 * 3600;

export interface EurRate {
  rate: number;
  date: string;
}

/** Reads the EUR rate and its date from the BNR XML (no XML library). */
export function parseBnrEur(xml: string): EurRate | null {
  const rate = /<Rate\s+currency="EUR"[^>]*>\s*([\d.]+)\s*<\/Rate>/.exec(xml);
  const date = /<Cube\s+date="(\d{4}-\d{2}-\d{2})"/.exec(xml);
  const n = rate ? Number(rate[1]) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return { rate: n, date: date ? date[1] : "" };
}

// caches.default exists on Cloudflare; under node --test it does not.
function edgeCache(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches;
  return c?.default ?? null;
}

export async function getEurRate(env: Pick<ToolEnv, "fetch">): Promise<EurRate | null> {
  const cache = edgeCache();
  if (cache) {
    try {
      const hit = await cache.match(CACHE_KEY);
      if (hit) {
        const v = parseBnrEur(await hit.text());
        if (v) return v;
      }
    } catch {
      // cache problems never block the answer
    }
  }
  let xml: string;
  try {
    const res = await env.fetch(BNR_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }
  const v = parseBnrEur(xml);
  if (v && cache) {
    try {
      await cache.put(
        CACHE_KEY,
        new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": `public, max-age=${CACHE_SECONDS}` } }),
      );
    } catch {
      // ignore
    }
  }
  return v;
}

export interface Thresholds {
  revenue_lei: number;
  vat_payer: boolean | null;
  vat_threshold_lei: number;
  vat_remaining_lei: number;
  vat_used_percent: number;
  vat_over: boolean;
  eur_rate: number | null;
  eur_rate_date: string | null;
  micro_ceiling_eur: number;
  micro_ceiling_lei: number | null;
  micro_remaining_lei: number | null;
  micro_used_percent: number | null;
  micro_over: boolean | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeThresholds(revenue: number, vatPayer: boolean | null, eur: EurRate | null): Thresholds {
  const microLei = eur ? r2(MICRO_CEILING_EUR * eur.rate) : null;
  return {
    revenue_lei: revenue,
    vat_payer: vatPayer,
    vat_threshold_lei: VAT_THRESHOLD_LEI,
    vat_remaining_lei: r2(VAT_THRESHOLD_LEI - revenue),
    vat_used_percent: r2((revenue / VAT_THRESHOLD_LEI) * 100),
    vat_over: revenue > VAT_THRESHOLD_LEI,
    eur_rate: eur?.rate ?? null,
    eur_rate_date: eur?.date || null,
    micro_ceiling_eur: MICRO_CEILING_EUR,
    micro_ceiling_lei: microLei,
    micro_remaining_lei: microLei === null ? null : r2(microLei - revenue),
    micro_used_percent: microLei === null ? null : r2((revenue / microLei) * 100),
    micro_over: microLei === null ? null : revenue > microLei,
  };
}

export function thresholdsMd(t: Thresholds, url: string): string {
  const lines: string[] = [`Cifra de afaceri anuala: ${formatLei(t.revenue_lei)}`, "", "**Plafonul de scutire de TVA (395.000 lei)**"];
  if (t.vat_payer === true) {
    lines.push("- Firma este deja platitoare de TVA, plafonul de scutire nu se mai aplica.");
  } else if (t.vat_over) {
    lines.push(
      `- Ai depasit plafonul cu ${formatLei(-t.vat_remaining_lei)} (${formatPercent(t.vat_used_percent)} din plafon).`,
      "- Verifica obligatia de inregistrare in scopuri de TVA cu contabilul; termenul curge de la depasire.",
    );
  } else {
    lines.push(`- Mai ai ${formatLei(t.vat_remaining_lei)} pana la plafon (ai folosit ${formatPercent(t.vat_used_percent)}).`);
  }
  lines.push("", "**Plafonul pentru microintreprindere (100.000 EUR)**");
  if (t.micro_ceiling_lei === null) {
    lines.push("- Cursul BNR nu este disponibil acum, nu pot calcula plafonul in lei. Incearca din nou mai tarziu.");
  } else {
    lines.push(
      `- La cursul BNR de ${formatNumber(t.eur_rate ?? 0, 4)} lei/EUR${t.eur_rate_date ? ` (${formatDateRo(t.eur_rate_date)})` : ""}, plafonul este ${formatLei(t.micro_ceiling_lei)}.`,
      t.micro_over
        ? `- Ai depasit plafonul cu ${formatLei(-(t.micro_remaining_lei ?? 0))}.`
        : `- Mai ai ${formatLei(t.micro_remaining_lei ?? 0)} pana la plafon (ai folosit ${formatPercent(t.micro_used_percent ?? 0)}).`,
      "- La incadrare conteaza cursul de la inchiderea exercitiului financiar; cursul de azi este o estimare.",
    );
  }
  lines.push("", `Calcul orientativ, nu inlocuieste contabilul. Ghiduri fiscale pentru magazine: ${url}`);
  return lines.join("\n");
}

export function createThresholdsTool(): ToolDef {
  return {
    name: NAME,
    title: "Cat mai ai pana la plafonul de TVA si de microintreprindere",
    description:
      "Compare annual revenue (cifra de afaceri anuala, in lei) with the Romanian VAT exemption threshold " +
      "(plafon de scutire TVA 395.000 lei) and the micro-enterprise ceiling (plafon microintreprindere 100.000 EUR, " +
      "converted at the official BNR EUR rate / curs BNR). Shows how much is left or by how much it is exceeded.",
    inputSchema: {
      type: "object",
      properties: {
        annual_revenue_lei: {
          type: "number",
          minimum: 0,
          maximum: 1000000000,
          description: "Cifra de afaceri pe an (sau de la inceputul anului), in lei",
        },
        vat_payer: { type: "boolean", description: "true daca firma este deja platitoare de TVA" },
      },
      required: ["annual_revenue_lei"],
      additionalProperties: false,
    },
    annotations: readOnly(true),
    async handler(args, env) {
      const revenue = Number(args.annual_revenue_lei);
      const vatPayer = typeof args.vat_payer === "boolean" ? args.vat_payer : null;
      const eur = await getEurRate(env);
      const t = computeThresholds(revenue, vatPayer, eur);
      const url = trackedUrl("/ghid", NAME);
      return { text: thresholdsMd(t, url), structured: { ...t, url } };
    },
  };
}
