// Run: npm test (node --test, native TypeScript type stripping, no dependencies).
// Answer tools with inline fixtures and a stubbed fetch (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ToolEnv } from "../src/lib/mcp/types.ts";
import { normalize, tokenize, searchEntries, formatLei, formatNumber, asArray, type KbEntry } from "../src/lib/mcp/text.ts";
import { trackedUrl } from "../src/lib/mcp/links.ts";
import { createSearchRulesTool } from "../src/lib/mcp/answers/rules.ts";
import { createDibalHelpTool } from "../src/lib/mcp/answers/dibal.ts";
import { decodeScaleBarcode, parseScaleBarcode, createDecodeScaleBarcodeTool } from "../src/lib/mcp/answers/scale-barcode.ts";
import { calculateShelfPrice, roundPriceCents } from "../src/lib/mcp/answers/shelf-price.ts";
import { checkCompany, isValidCui, normalizeCui, parseAnafResponse, ANAF_URL } from "../src/lib/mcp/answers/company.ts";
import { parseBnrEur, computeThresholds, createThresholdsTool, BNR_URL } from "../src/lib/mcp/answers/thresholds.ts";
import { createChecklistTool, BUSINESS_TYPES, pageFor, type Checklist } from "../src/lib/mcp/answers/checklist.ts";
import { createCompareTool, featureState, type Competitor } from "../src/lib/mcp/answers/compare.ts";
import { splitEans, mapPool, createProductsTool } from "../src/lib/mcp/answers/products.ts";
import { findDatecsCode, searchDatecsText, createDatecsTool, datecsAnchor, type DatecsKb } from "../src/lib/mcp/answers/datecs.ts";
import datecsJson from "../src/lib/kb/datecs-errors.json" with { type: "json" };
import dibalJson from "../src/lib/kb/dibal.json" with { type: "json" };
import checklistsJson from "../src/lib/kb/shop-checklists.json" with { type: "json" };

const datecs = datecsJson as unknown as DatecsKb;
const noRpc: ToolEnv["rpc"] = async () => ({ ok: false, kind: "missing", message: "x" });

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): ToolEnv {
  return { rpc: noRpc, fetch: (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch };
}

const entry = (over: Partial<KbEntry>): KbEntry => ({
  id: "x",
  title: "",
  summary: "",
  body: "",
  keywords: [],
  sources: [{ title: "ANAF", url: "https://www.anaf.ro/" }],
  verified_on: "2026-09-30",
  page: "/ghid/x",
  ...over,
});

const RULES: KbEntry[] = [
  entry({
    id: "plafon-numerar",
    title: "Plafoane de numerar",
    summary: "Incasari in numerar de maxim 5.000 lei pe zi de la o persoana.",
    body: "Soldul casei nu poate depasi 50.000 lei.",
    keywords: ["plafon numerar", "registru de casa", "cash"],
    page: "/ghid/plafon-numerar",
  }),
  entry({
    id: "tva-casa-de-marcat",
    title: "Cote TVA pe casa de marcat",
    summary: "Cota standard este 21%, cota redusa 11% (alimente, inclusiv paine).",
    body: "Programeaza grupele de TVA si pune painea pe grupa cu 11%.",
    keywords: ["tva", "grupa tva", "cota tva", "paine", "alimente"],
    page: "/ghid/tva-casa-de-marcat",
  }),
];

test("text helpers", () => {
  assert.equal(normalize("Pâine și Țuică!"), "paine si tuica");
  assert.deepEqual(tokenize("Ce grupa TVA pun pentru pâine?"), ["grupa", "tva", "pun", "paine"]);
  assert.equal(formatLei(12.99), "12,99 lei");
  assert.equal(formatLei(395000), "395.000,00 lei");
  assert.equal(formatNumber(-0.001, 2), "0,00");
  assert.deepEqual(asArray({ entries: [1, 2] }), [1, 2]);
  assert.deepEqual(asArray([3]), [3]);
  assert.deepEqual(asArray(null), []);
  assert.equal(
    trackedUrl("/ghid/x#a", "t"),
    "https://tapselo.com/ghid/x?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=t#a",
  );
});

test("search: Romanian inflection and diacritics, top hit first", () => {
  const hits = searchEntries(RULES, "Ce grupa TVA pun pentru painea de pe casa de marcat?");
  assert.equal(hits[0].id, "tva-casa-de-marcat");
  assert.equal(searchEntries(RULES, "cât numerar pot ține în casă")[0].id, "plafon-numerar");
  assert.deepEqual(searchEntries(RULES, "xyz qwerty"), []);
  assert.deepEqual(searchEntries(RULES, "ce de la"), []);
});

test("search_business_rules: answer with summary, sources, date and tracked page link", async () => {
  const tool = createSearchRulesTool(RULES);
  const r = await tool.handler({ query: "Ce grupa TVA pun pentru paine pe casa de marcat?" }, stubFetch(() => new Response()));
  assert.match(r.text, /### Cote TVA pe casa de marcat/);
  assert.match(r.text, /11%/);
  assert.match(r.text, /Surse:\n- \[ANAF\]\(https:\/\/www.anaf.ro\/\)/);
  assert.match(r.text, /Verificat la 30\.09\.2026/);
  assert.match(r.text, /https:\/\/tapselo.com\/ghid\/tva-casa-de-marcat\?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=search_business_rules/);
  const none = await tool.handler({ query: "zzzz" }, stubFetch(() => new Response()));
  assert.match(none.text, /Nu am gasit/);
  assert.match(none.text, /\/ghid\?utm_source=ai-plugin/);
});

test("dibal_scale_help on the real dibal.json", async () => {
  const entries = dibalJson as unknown as KbEntry[];
  for (const e of entries) {
    assert.ok(e.id && e.title && e.summary && e.body && e.keywords.length && e.sources.length, e.id);
    assert.match(e.verified_on, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.page.startsWith("/ghid/cantar-dibal"), e.id);
    for (const s of e.sources) assert.match(s.url, /^https:\/\//);
  }
  const tool = createDibalHelpTool(entries);
  const r = await tool.handler({ query: "codul de bare de pe eticheta nu se scaneaza" }, stubFetch(() => new Response()));
  assert.match(r.text, /De ce nu se scaneaza/);
  assert.match(r.text, /utm_campaign=dibal_scale_help/);
  const ip = await tool.handler({ query: "cantarul nu se conecteaza, ce IP pun?" }, stubFetch(() => new Response()));
  assert.match(ip.text.split("---")[0], /5 1 2/);
});

test("decode_scale_barcode: port of parseScaleBarcode plus check digit", async () => {
  assert.deepEqual(parseScaleBarcode("2800123012345"), { scaleCode: "123", weightKg: 1.234 });
  assert.equal(parseScaleBarcode("2801000012345"), null); // PLU 1000
  assert.equal(parseScaleBarcode("2900123012345"), null);
  const d = decodeScaleBarcode("2800123012345");
  assert.ok(d.ok);
  if (d.ok) {
    assert.equal(d.plu, 123);
    assert.equal(d.weight_kg, 1.234);
    assert.equal(d.check_digit_valid, false);
    assert.equal(d.expected_check_digit, 2);
    assert.equal(d.pos_accepts, true);
  }
  const good = decodeScaleBarcode("2800123012342");
  assert.ok(good.ok && good.check_digit_valid && good.warnings.length === 0);
  const price = decodeScaleBarcode("2900045023507", "price");
  assert.ok(price.ok && price.price_lei === 23.5 && price.weight_kg === null);
  assert.equal(decodeScaleBarcode("5941234567890").ok, false);
  assert.equal(decodeScaleBarcode("12345").ok, false);

  const tool = createDecodeScaleBarcodeTool();
  const r = await tool.handler({ barcode: "2800123012345" }, stubFetch(() => new Response()));
  assert.match(r.text, /PLU \(cod cantar\): 123/);
  assert.match(r.text, /Greutate: 1,234 kg \(1\.234 g\)/);
  assert.match(r.text, /gresita, corect ar fi 2/);
  const bad = await tool.handler({ barcode: "5449000000996" }, stubFetch(() => new Response()));
  assert.equal(bad.isError, true);
});

test("calculate_shelf_price: math, rounding, margin, unit price", () => {
  assert.equal(roundPriceCents(1443, "0.49_0.99"), 1449);
  assert.equal(roundPriceCents(1449, "0.49_0.99"), 1449);
  assert.equal(roundPriceCents(1450, "0.49_0.99"), 1499);
  assert.equal(roundPriceCents(1443, "0.09"), 1449);
  assert.equal(roundPriceCents(1450, "0.09"), 1459);
  assert.equal(roundPriceCents(1443, "none"), 1443);

  const p = calculateShelfPrice({ cost: 10, markup_percent: 30, vat_rate: 11, rounding: "0.49_0.99" });
  assert.equal(p.price_before_rounding, 14.43);
  assert.equal(p.price_with_vat, 14.49);
  assert.equal(p.price_without_vat, 13.05);
  assert.equal(p.vat_amount, 1.44);
  assert.equal(p.markup_percent, 30.54);

  const m = calculateShelfPrice({ cost: 10, target_margin_percent: 20, vat_rate: 21 });
  assert.equal(m.price_with_vat, 15.13); // 12.5 * 1.21 = 15.125 -> 15.13
  assert.equal(m.price_without_vat, 12.5);

  const u = calculateShelfPrice({ cost: 8, markup_percent: 25, vat_rate: 11, unit_quantity: 250, unit: "g" });
  assert.equal(u.price_with_vat, 11.1);
  assert.equal(u.unit_price, 44.4);
  assert.equal(u.unit_price_label, "44,40 lei/kg");
  const l = calculateShelfPrice({ cost: 4, markup_percent: 0, vat_rate: 0, unit_quantity: 500, unit: "ml" });
  assert.equal(l.unit_price_label, "8,00 lei/l");

  assert.throws(() => calculateShelfPrice({ cost: 10, vat_rate: 21 }), RangeError);
  assert.throws(() => calculateShelfPrice({ cost: 10, vat_rate: 21, markup_percent: 1, target_margin_percent: 1 }), RangeError);
});

// Trimmed from the live ANAF answer for CUI 14399840 on 2026-10-01.
const ANAF_SAMPLE = JSON.stringify({
  found: [
    {
      date_generale: {
        data: "2026-10-01",
        cui: 14399840,
        denumire: "DANTE INTERNATIONAL SA",
        adresa: "MUNICIPIUL BUCUREŞTI, SECTOR 2, STR. GARA HERĂSTRĂU, NR.6, CLADIREA GLOBALWORTH SQUARE, ET.1,2,3,5,8",
        stare_inregistrare: "INREGISTRAT din data 29.08.2006",
        data_inreg_Reg_RO_e_Factura: "",
        nrRegCom: "J2002000372404",
        cod_CAEN: "4754",
        statusRO_e_Factura: false,
      },
      inregistrare_scop_Tva: { scpTVA: true, perioade_TVA: [{ data_inceput_ScpTVA: "2002-02-01", data_sfarsit_ScpTVA: "" }] },
      inregistrare_RTVAI: { statusTvaIncasare: false },
      stare_inactiv: { dataInactivare: "", dataReactivare: "", dataPublicare: "", dataRadiere: "", statusInactivi: false },
      inregistrare_SplitTVA: { statusSplitTVA: false },
    },
  ],
  notFound: [],
});

test("check_company: CUI checks, parser, live-shape fixture, friendly failures", async () => {
  assert.equal(normalizeCui("RO 14399840"), "14399840");
  assert.equal(normalizeCui("ro14399840"), "14399840");
  assert.equal(normalizeCui(14399840), "14399840");
  assert.equal(normalizeCui("abc"), null);
  assert.ok(isValidCui("14399840"));
  assert.ok(!isValidCui("14399841"));

  const info = parseAnafResponse(ANAF_SAMPLE.replace("DANTE", "DANTE\u0001"), "14399840");
  assert.ok(info);
  assert.equal(info?.vat_payer, true);
  assert.equal(info?.caen, "4754");
  assert.equal(info?.inactive, false);
  assert.equal(parseAnafResponse(JSON.stringify({ found: [], notFound: [1] }), "1"), null);
  assert.throws(() => parseAnafResponse("{}", "1"));

  let sent: unknown = null;
  const ok = await checkCompany(
    "RO14399840",
    stubFetch((url, init) => {
      assert.equal(url, ANAF_URL);
      sent = JSON.parse(String(init?.body));
      assert.ok(init?.signal);
      return new Response(ANAF_SAMPLE, { status: 200 });
    }),
    "2026-10-01",
  );
  assert.deepEqual(sent, [{ cui: 14399840, data: "2026-10-01" }]);
  assert.match(ok.text, /\*\*DANTE INTERNATIONAL SA\*\* \(CUI 14399840\)/);
  assert.match(ok.text, /Platitor de TVA: da/);
  assert.match(ok.text, /Cod CAEN: 4754/);
  assert.match(ok.text, /In Registrul RO e-Factura: nu/);
  assert.match(ok.text, /utm_campaign=check_company/);

  const down = await checkCompany("14399840", stubFetch(() => { throw new Error("timeout"); }));
  assert.equal(down.isError, true);
  assert.match(down.text, /ANAF nu raspunde/);
  assert.match(down.text, /https:\/\/www.anaf.ro\/RegistruTVA\//);
  const http500 = await checkCompany("14399840", stubFetch(() => new Response("oops", { status: 500 })));
  assert.equal(http500.isError, true);
  const invalid = await checkCompany("14399841", stubFetch(() => { throw new Error("must not call"); }));
  assert.equal(invalid.isError, true);
  const notFound = await checkCompany(
    "14399840",
    stubFetch(() => new Response(JSON.stringify({ found: [], notFound: [14399840] }))),
  );
  assert.match(notFound.text, /ANAF nu are date/);
});

const BNR_XML = `<?xml version="1.0" encoding="utf-8"?><DataSet xmlns="https://www.bnr.ro/xsd"><Header><PublishingDate>2026-09-30</PublishingDate></Header><Body><Cube date="2026-09-30"><Rate currency="AED">1.2653</Rate><Rate currency="EUR">5.2785</Rate><Rate currency="HUF" multiplier="100">1.4406</Rate></Cube></Body></DataSet>`;

test("check_tax_thresholds: BNR parse, math, cache-less fetch, BNR down", async () => {
  assert.deepEqual(parseBnrEur(BNR_XML), { rate: 5.2785, date: "2026-09-30" });
  assert.equal(parseBnrEur("<html>404</html>"), null);

  const t = computeThresholds(300000, false, { rate: 5, date: "2026-09-30" });
  assert.equal(t.vat_remaining_lei, 95000);
  assert.equal(t.micro_ceiling_lei, 500000);
  assert.equal(t.micro_remaining_lei, 200000);
  assert.equal(t.vat_over, false);
  assert.equal(computeThresholds(400000, false, null).vat_over, true);

  const tool = createThresholdsTool();
  let calls = 0;
  const r = await tool.handler(
    { annual_revenue_lei: 300000 },
    stubFetch((url) => {
      calls++;
      assert.equal(url, BNR_URL);
      return new Response(BNR_XML);
    }),
  );
  assert.equal(calls, 1);
  assert.match(r.text, /Mai ai 95\.000,00 lei pana la plafon/);
  assert.match(r.text, /5,2785 lei\/EUR \(30\.09\.2026\), plafonul este 527\.850,00 lei/);
  assert.match(r.text, /utm_campaign=check_tax_thresholds/);

  const over = await tool.handler({ annual_revenue_lei: 600000 }, stubFetch(() => new Response("", { status: 404 })));
  assert.match(over.text, /Ai depasit plafonul cu 205\.000,00 lei/);
  assert.match(over.text, /Cursul BNR nu este disponibil/);
  const payer = await tool.handler({ annual_revenue_lei: 600000, vat_payer: true }, stubFetch(() => new Response(BNR_XML)));
  assert.match(payer.text, /deja platitoare de TVA/);
});

test("open_shop_checklist: real KB shape (caen, steps, fiscal, documents), sources, tracked link", async () => {
  const tool = createChecklistTool([
    {
      id: "deschide-macelarie",
      business_type: "macelarie",
      title: "Cum deschizi o macelarie",
      summary: "Ai nevoie de inregistrare sanitar-veterinara DSV.",
      caen: [{ code: "4722", label: "Comert cu amanuntul al carnii" }],
      steps: [
        { title: "Inregistrare DSVSA", body: "Depui cererea la DSVSA.", authority: "DSVSA", sources: [{ title: "ANSVSA", url: "https://www.ansvsa.ro/" }] },
      ],
      fiscal: ["Emiteti bon fiscal."],
      documents: ["Registrul unic de control"],
      keywords: [],
      verified_on: "2026-10-01",
      page: "/ghid/deschide-macelarie",
    },
  ]);
  const r = await tool.handler({ business_type: "macelarie" }, stubFetch(() => new Response()));
  assert.match(r.text, /### Cum deschizi o macelarie/);
  assert.match(r.text, /\*\*Coduri CAEN\*\*\n- 4722 - Comert cu amanuntul al carnii/);
  assert.match(r.text, /1\. \*\*Inregistrare DSVSA\*\* \(DSVSA\)\n   Depui cererea la DSVSA\.\n   Surse: \[ANSVSA\]\(https:\/\/www.ansvsa.ro\/\)/);
  assert.match(r.text, /\*\*Obligatii fiscale\*\*\n- Emiteti bon fiscal\./);
  assert.match(r.text, /\*\*Documente de pastrat\*\*\n- Registrul unic de control/);
  assert.match(r.text, /Verificat la 01\.10\.2026/);
  assert.match(r.text, /deschide-macelarie\?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=open_shop_checklist/);
  assert.deepEqual((r.structured as { sources: unknown[] }).sources, [{ title: "ANSVSA", url: "https://www.ansvsa.ro/" }]);
  const missing = await tool.handler({ business_type: "brutarie_patiserie" }, stubFetch(() => new Response()));
  assert.match(missing.text, /nu este gata inca/);
});

test("open_shop_checklist on the real shop-checklists.json: every business type, page = /ghid/deschide-*", async () => {
  const tool = createChecklistTool(checklistsJson as unknown as Checklist[]);
  for (const t of BUSINESS_TYPES) {
    const r = await tool.handler({ business_type: t }, stubFetch(() => new Response()));
    const s = r.structured as { found: boolean; url: string; sources: unknown[] };
    assert.ok(s.found, t);
    assert.ok(s.url.startsWith(`https://tapselo.com${pageFor(t)}?`), s.url);
    assert.ok(s.sources.length > 0, t);
    assert.match(r.text, /\*\*Coduri CAEN\*\*/);
    assert.match(r.text, /\*\*Pasi\*\*/);
  }
});

const VENDORS: Competitor[] = [
  { name: "Alfa POS", url: "https://alfa.example", segments: ["horeca"], offline: false, fiscal_printers: true, scales: null, recipes_production: true, inventory: true, ecommerce_or_orders: null, pricing_public: "da", pricing_from: "99 lei/luna", verified_on: "2026-09-29" },
  { name: "Tapselo", url: "https://tapselo.com", segments: ["brutarie", "alimentar"], offline: true, fiscal_printers: ["Datecs"], scales: "Dibal", recipes_production: true, inventory: true, ecommerce_or_orders: true, pricing_public: null, pricing_from: null, verified_on: "2026-10-01" },
  { name: "Beta | Soft", url: "https://beta.example", segments: ["retail"], offline: "nu", fiscal_printers: true, scales: false, recipes_production: false, inventory: true, ecommerce_or_orders: false, verified_on: "2026-09-28" },
];

test("compare_pos_systems: disclosure first, ranking, unknown as necunoscut", async () => {
  assert.equal(featureState(null), null);
  assert.equal(featureState("nu"), false);
  assert.equal(featureState("Datecs, Daisy"), true);
  assert.equal(featureState([]), false);
  const tool = createCompareTool(VENDORS);
  const r = await tool.handler({ business_type: "brutarie_patiserie", needs: ["recipes", "offline"] }, stubFetch(() => new Response()));
  const lines = r.text.split("\n");
  assert.ok(lines[0].startsWith("Comparatie realizata de Tapselo."));
  assert.match(lines[0], /verificate intre 28\.09\.2026 si 01\.10\.2026/);
  const table = lines.filter((l) => l.startsWith("| ["));
  assert.match(table[0], /Tapselo/); // 2 of 2 needs
  assert.match(table[0], /\[Tapselo\]\(https:\/\/tapselo.com\/\?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=compare_pos_systems\)/);
  assert.match(table[1], /\(https:\/\/alfa.example\)/);
  assert.match(table[1], /Alfa POS.*\| da \| nu \|/);
  assert.match(r.text, /Beta \\\| Soft/);
  assert.match(r.text, /\/comparatie\?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=compare_pos_systems/);
  assert.equal((r.structured as { disclosure: string }).disclosure, "Comparatie realizata de Tapselo.");
});

test("lookup_products_by_ean: validation, pool concurrency, OFF parsing", async () => {
  const { valid, invalid } = splitEans(["5449000000996", "5449000000996", "5941234567890", "96385074", "abc"]);
  assert.deepEqual(valid, ["5449000000996", "96385074"]);
  assert.deepEqual(invalid, ["5941234567890", "abc"]);

  let inFlight = 0;
  let peak = 0;
  const out = await mapPool([...Array(12).keys()], 5, async (i) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return i * 2;
  });
  assert.equal(peak, 5);
  assert.deepEqual(out, [...Array(12).keys()].map((i) => i * 2));

  const tool = createProductsTool();
  const seen: string[] = [];
  const env = stubFetch((url, init) => {
    seen.push(url);
    assert.match(String((init?.headers as Record<string, string>)["User-Agent"]), /Tapselo/);
    if (url.includes("5449000000996")) {
      return new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: "Coca-Cola", brands: "Coca-Cola", quantity: "330 ml", image_url: "https://images.openfoodfacts.org/x.jpg", nutriscore_grade: "e" },
        }),
      );
    }
    return new Response(JSON.stringify({ status: 0, status_verbose: "product not found" }), { status: 404 });
  });
  const r = await tool.handler({ eans: ["5449000000996", "96385074", "5941234567890"] }, env);
  assert.equal(seen.length, 2);
  assert.match(seen[0], /^https:\/\/world.openfoodfacts.org\/api\/v2\/product\/5449000000996\?fields=/);
  assert.match(r.text, /\| 5449000000996 \| Coca-Cola \| Coca-Cola \| 330 ml \| E \| \[imagine\]\(https:\/\/images.openfoodfacts.org\/x.jpg\) \|/);
  assert.match(r.text, /Negasite: 96385074/);
  assert.match(r.text, /Coduri invalide.*5941234567890/);
  assert.match(r.text, /Open Food Facts/);
  const none = await tool.handler({ eans: ["123"] }, env);
  assert.equal(none.isError, true);
});

test("datecs KB: generated JSON shape and hints", () => {
  assert.ok(Object.keys(datecs.codes).length > 500);
  assert.equal(datecs.codes["-111008"].ro, "Eroare in mod Inregistrare: Grup in afara domeniului");
  assert.equal(datecs.codes["-100403"].en, "Line thermal printer mechanism error: Paper end");
  assert.equal(datecs.codes["-6"].ro, null);
  for (const [code, h] of Object.entries(datecs.hints)) {
    assert.ok(datecs.codes[code], code);
    assert.ok(h.title && h.steps.length >= 2, code);
  }
  for (const c of ["-100403", "-100404", "-111024", "-112004", "-111008", "-100114", "-111002"]) assert.ok(datecs.hints[c], c);
  assert.ok(!Object.values(datecs.codes).some((c) => /_ERR_|ŚūūÓū/.test(c.en)));
});

test("explain_datecs_error: code forms, text search, unknown code", async () => {
  for (const input of ["-111008", "111008", "ERR 111008", "eroarea -111.008"]) assert.equal(findDatecsCode(datecs, input), "-111008", input);
  assert.equal(findDatecsCode(datecs, "0"), "0");
  assert.equal(findDatecsCode(datecs, "999999"), null);
  assert.equal(datecsAnchor("-111008"), "cod-111008");
  assert.ok(searchDatecsText(datecs, "lipsa hartie").includes("-100403"));

  const tool = createDatecsTool(datecs);
  const env = stubFetch(() => new Response());
  const r = await tool.handler({ code: "-111008" }, env);
  assert.match(r.text, /\*\*Eroare Datecs -111008\*\*/);
  assert.match(r.text, /Romana: Eroare in mod Inregistrare: Grup in afara domeniului/);
  assert.match(r.text, /English: Registration mode error: Group is not in range/);
  assert.match(r.text, /\*\*Ce faci: Grupa de TVA/);
  assert.match(r.text, /\/ghid\/erori-datecs\?utm_source=ai-plugin&utm_medium=mcp&utm_campaign=explain_datecs_error#cod-111008/);
  const paper = await tool.handler({ text: "capac deschis" }, env);
  assert.match(paper.text, /Capac deschis|Coduri posibile/);
  const unknown = await tool.handler({ code: "123" }, env);
  assert.match(unknown.text, /Nu am gasit codul "123"/);
  const empty = await tool.handler({}, env);
  assert.equal(empty.isError, true);
});
