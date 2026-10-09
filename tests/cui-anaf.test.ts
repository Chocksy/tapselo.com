import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCui, normalizeCui } from "../src/lib/cui-anaf/normalize.ts";
import { parseAnafResponse } from "../src/lib/cui-anaf/parse.ts";
import { efacturaRegistryValue } from "../src/lib/cui-anaf/labels.ts";
import { AnafRequestThrottle } from "../src/lib/cui-anaf/throttle.ts";
import { assertCuiBatchWithinLimit, fetchAnafCompany, handleAnafCuiGet } from "../src/lib/cui-anaf/proxy.ts";
import { ANAF_MAX_CUIS_PER_REQUEST, ANAF_TVA_URL } from "../src/lib/cui-anaf/constants.ts";

const ANAF_SAMPLE = JSON.stringify({
  found: [
    {
      date_generale: {
        data: "2026-10-09",
        cui: 14399840,
        denumire: "DANTE INTERNATIONAL SA",
        adresa: "BUCUREŞTI",
        stare_inregistrare: "INREGISTRAT",
        data_inreg_Reg_RO_e_Factura: "",
        nrRegCom: "J2002000372404",
        cod_CAEN: "4754",
        statusRO_e_Factura: false,
      },
      inregistrare_scop_Tva: { scpTVA: true },
      inregistrare_RTVAI: { statusTvaIncasare: false },
      stare_inactiv: { statusInactivi: false, dataRadiere: "" },
      inregistrare_SplitTVA: { statusSplitTVA: false },
    },
  ],
  notFound: [],
});

test("CUI normalize and checksum", () => {
  assert.equal(normalizeCui("RO 14399840"), "14399840");
  assert.equal(normalizeCui("ro14399840"), "14399840");
  assert.equal(normalizeCui("abc"), null);
  assert.ok(isValidCui("14399840"));
  assert.ok(!isValidCui("14399841"));
});

test("parseAnafResponse maps VAT and e-Factura fields", () => {
  const info = parseAnafResponse(ANAF_SAMPLE, "14399840");
  assert.ok(info);
  assert.equal(info?.name, "DANTE INTERNATIONAL SA");
  assert.equal(info?.vat_payer, true);
  assert.equal(info?.vat_on_cash, false);
  assert.equal(info?.split_vat, false);
  assert.equal(info?.inactive, false);
  assert.equal(info?.efactura_registry, false);
  assert.equal(efacturaRegistryValue(false, null), "nu apare în Registrul RO e-Factura");
  assert.equal(efacturaRegistryValue(true, null), "da");
});

test("AnafRequestThrottle enforces ~1 second gap", async () => {
  const t = new AnafRequestThrottle(100);
  const start = Date.now();
  await t.acquire(start);
  await t.acquire();
  assert.ok(Date.now() - start >= 90);
});

test("assertCuiBatchWithinLimit", () => {
  assert.throws(() => assertCuiBatchWithinLimit(101), /100/);
  assert.throws(() => assertCuiBatchWithinLimit(0));
});

test("proxy fetchAnafCompany uses ANAF POST body and caches", async () => {
  let calls = 0;
  const memory = new Map<string, Response>();
  const cache = {
    async match(key: string) {
      return memory.get(key) ?? undefined;
    },
    async put(key: string, res: Response) {
      memory.set(key, res.clone());
    },
  } as Cache;

  const throttle = new AnafRequestThrottle(0);
  const fetchFn: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, ANAF_TVA_URL);
    const body = JSON.parse(String(init?.body)) as { cui: number; data: string }[];
    assert.equal(body.length, 1);
    assert.equal(body[0].cui, 14399840);
    assert.match(body[0].data, /^\d{4}-\d{2}-\d{2}$/);
    return new Response(ANAF_SAMPLE, { status: 200 });
  };

  const first = await fetchAnafCompany("14399840", {
    fetch: fetchFn,
    throttle,
    today: "2026-10-09",
    cache,
    cacheKey: (c, d) => `k:${c}:${d}`,
  });
  assert.equal(first.ok, true);
  assert.equal(calls, 1);

  const second = await fetchAnafCompany("14399840", {
    fetch: fetchFn,
    throttle,
    today: "2026-10-09",
    cache,
    cacheKey: (c, d) => `k:${c}:${d}`,
  });
  assert.equal(second.ok, true);
  assert.equal(calls, 1);
});

test("handleAnafCuiGet rejects invalid CUI without calling ANAF", async () => {
  let called = false;
  const res = await handleAnafCuiGet(new Request("https://tapselo.com/api/anaf/cui/bad"), "bad", {
    fetch: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
    throttle: new AnafRequestThrottle(0),
  });
  assert.equal(res.status, 400);
  assert.ok(!called);
});

test("handleAnafCuiGet returns 429 when throttled", async () => {
  const throttle = new AnafRequestThrottle(60_000);
  await throttle.acquire(Date.now());
  const res = await handleAnafCuiGet(new Request("https://tapselo.com/api/anaf/cui/14399840"), "14399840", {
    fetch: async () => new Response(ANAF_SAMPLE, { status: 200 }),
    throttle,
    today: "2026-10-09",
  });
  assert.equal(res.status, 429);
});
