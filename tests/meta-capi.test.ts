// Meta CAPI allowlist, origin check and no-op without env.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCapiEvent, capiConfig, graphRequest } from "../src/lib/meta/capi.ts";
import { buildCarry, buildDemoParams, isDemoHref, pickDemoParams, resolvePixelId, withCarry } from "../src/lib/meta/pixel.ts";
import { handleMetaCapi } from "../functions/api/meta-capi.ts";

const meta = {
  origin: "https://tapselo.com",
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 test",
  cookie: "_fbp=fb.1.1700000000000.123456789; _fbc=fb.1.1700000000000.AbC_dEf; other=x",
  now: 1_760_000_000_000,
};
const good = {
  event_name: "demo_started",
  event_id: "0f8c3b2a-1111-4222-8333-944455556666",
  event_source_url: "https://tapselo.com/demo/?utm_source=meta",
  custom_data: { landing_page: "/demo/", page_path: "/demo/", utm_source: "meta", utm_campaign: "xs-meta-test-2610" },
};

test("only allowlisted fields get through, PII and business data are dropped", () => {
  const evil = {
    ...good,
    email: "a@b.ro",
    phone: "0722123456",
    em: "hash",
    user_data: { em: "x", ph: "y", external_id: "z" },
    custom_data: {
      ...good.custom_data,
      value: 129,
      currency: "RON",
      price: "79",
      cui: "RO12345678",
      company: "Magazin Test SRL",
      barcode: "5941234567890",
      email: "a@b.ro",
      utm_content: "5941234567890",
      utm_term: "client@firma.ro",
    },
  };
  const e = buildCapiEvent(evil, meta)!;
  assert.deepEqual(Object.keys(e).sort(), ["action_source", "custom_data", "event_id", "event_name", "event_source_url", "event_time", "user_data"]);
  assert.deepEqual(e.custom_data, good.custom_data);
  assert.deepEqual(Object.keys(e.user_data).sort(), ["client_ip_address", "client_user_agent", "fbc", "fbp"]);
  assert.equal(e.event_source_url, "https://tapselo.com/demo/");
  assert.equal(e.event_id, good.event_id);
  const s = JSON.stringify(e);
  for (const bad of ["a@b.ro", "0722123456", "RO12345678", "Magazin", "5941234567890", "129", "external_id", '"em"', '"ph"']) {
    assert.ok(!s.includes(bad), `leaked ${bad}`);
  }
});

test("rejects wrong origin, wrong page, wrong event, bad event_id", () => {
  assert.equal(buildCapiEvent(good, { ...meta, origin: "https://evil.example" }), null);
  assert.equal(buildCapiEvent(good, { ...meta, origin: null }), null);
  assert.equal(buildCapiEvent({ ...good, event_source_url: "https://tapselo.com/" }, meta), null);
  assert.equal(buildCapiEvent({ ...good, event_source_url: "https://evil.example/demo/" }, meta), null);
  assert.equal(buildCapiEvent({ ...good, event_name: "Purchase" }, meta), null);
  assert.equal(buildCapiEvent({ ...good, event_id: "x" }, meta), null);
});

test("no-op without token or pixel id: 204 and no fetch", async () => {
  let calls = 0;
  const fake = (async () => {
    calls++;
    return new Response("{}");
  }) as typeof fetch;
  const req = () => new Request("https://tapselo.com/api/meta-capi", { method: "POST", headers: { Origin: "https://tapselo.com" }, body: JSON.stringify(good) });
  for (const env of [{}, { META_CAPI_TOKEN: "t" }, { META_PIXEL_ID: "1234567890" }, { META_CAPI_TOKEN: "", META_PIXEL_ID: "1234567890" }]) {
    const r = await handleMetaCapi({ request: req(), env }, fake);
    assert.equal(r.status, 204);
  }
  assert.equal(calls, 0);
  assert.equal(capiConfig({}), null);
  assert.equal(resolvePixelId(undefined), null);
  assert.equal(resolvePixelId(""), null);
  assert.equal(resolvePixelId("not-an-id"), null);
});

test("configured: forwards one event with the same event_id; bad origin is 403", async () => {
  const sent: { url: string; body: string }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: String(init.body) });
    return new Response("{}");
  }) as unknown as typeof fetch;
  const env = { META_CAPI_TOKEN: "tok", META_PIXEL_ID: "1234567890" };
  const mk = (origin: string) =>
    new Request("https://tapselo.com/api/meta-capi", { method: "POST", headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.7" }, body: JSON.stringify(good) });
  assert.equal((await handleMetaCapi({ request: mk("https://evil.example"), env }, fake)).status, 403);
  assert.equal((await handleMetaCapi({ request: mk("https://tapselo.com"), env }, fake)).status, 202);
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1234567890\/events\?access_token=tok$/);
  const body = JSON.parse(sent[0].body);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].event_id, good.event_id);
  assert.equal(body.data[0].user_data.client_ip_address, "203.0.113.7");
  const { url } = graphRequest(capiConfig(env)!, buildCapiEvent(good, meta)!);
  assert.ok(url.includes("/1234567890/events"));
});

test("browser params: allowlist, demo links, carry", () => {
  assert.deepEqual(pickDemoParams({ landing_page: "/x/?q=1", page_path: "//evil", utm_source: "meta", gclid: "g", email: "a@b.ro" }), {
    landing_page: "/x/",
    utm_source: "meta",
  });
  assert.deepEqual(buildDemoParams("/demo/", "?utm_source=meta&utm_medium=paid_social&cui=RO123456", null), {
    landing_page: "/demo/",
    page_path: "/demo/",
    utm_source: "meta",
    utm_medium: "paid_social",
  });
  assert.ok(isDemoHref("https://app.tapselo.com/?demo=1"));
  assert.ok(isDemoHref("https://demo.tapselo.com/"));
  assert.ok(!isDemoHref("https://app.tapselo.com/"));
  assert.ok(!isDemoHref("/demo/"));
  assert.ok(!isDemoHref("http://demo.tapselo.com/"));
  const carry = buildCarry({ params: { utm_source: "meta", landing_page: "/demo/" }, fbclid: "AbC", fbc: "fb.1.1.AbC", fbp: "fb.1.2.3", eventId: good.event_id });
  assert.deepEqual(Object.keys(carry).sort(), ["event_id", "fbc", "fbclid", "fbp", "landing_page", "utm_source"]);
  const href = withCarry("https://app.tapselo.com/?demo=1", carry);
  assert.match(href, /^https:\/\/app\.tapselo\.com\/\?demo=1&/);
  assert.ok(href.includes(`event_id=${good.event_id}`));
});

test("consent contract: cookies, attr payload, tc=1, Refuz clears tapselo_attr", async () => {
  const { attrCookie, consentCookies, demoHrefWithConsent, stripCarry } = await import("../src/lib/meta/pixel.ts");
  const [granted] = consentCookies("granted");
  assert.equal(granted, "tapselo_consent=marketing; Domain=.tapselo.com; Path=/; SameSite=Lax; Secure; Max-Age=15552000");
  const denied = consentCookies("denied");
  assert.equal(denied[0], "tapselo_consent=denied; Domain=.tapselo.com; Path=/; SameSite=Lax; Secure; Max-Age=15552000");
  assert.equal(denied[1], "tapselo_attr=; Domain=.tapselo.com; Path=/; SameSite=Lax; Secure; Max-Age=0");
  const carry = { utm_source: "meta", event_id: good.event_id, landing_page: "/demo/" };
  const c = attrCookie(carry);
  assert.match(c, /^tapselo_attr=.+; Domain=\.tapselo\.com; Path=\/; SameSite=Lax; Secure; Max-Age=604800$/);
  const payload = JSON.parse(decodeURIComponent(c.split(";")[0].slice("tapselo_attr=".length)));
  assert.deepEqual(payload, { ...carry, consent: "marketing" });
  const href = demoHrefWithConsent("https://app.tapselo.com/?demo=1", carry);
  const u = new URL(href);
  assert.equal(u.searchParams.get("tc"), "1");
  assert.equal(u.searchParams.get("demo"), "1");
  assert.equal(u.searchParams.get("event_id"), good.event_id);
  assert.equal(stripCarry(href), "https://app.tapselo.com/?demo=1");
});
