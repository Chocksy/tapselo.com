import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_RELAY_URL,
  onRequestPost,
  sendToEmailRelay,
} from "../functions/api/contact.js";

const realFetch = globalThis.fetch;
const realLog = console.log;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
});

const PAYLOAD = { name: "Ana Test", email: "ana@example.test", phone: "", message: "Salut" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formRequest(body: Record<string, unknown>) {
  return new Request("https://tapselo.com/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

test("uses the EMAIL_RELAY service binding when present", async () => {
  console.log = () => {};
  const seen: Request[] = [];
  let publicCalls = 0;
  const env = {
    EMAIL_RELAY: {
      fetch: async (req: Request) => {
        seen.push(req);
        return json({ success: true });
      },
    },
  };
  const res = await sendToEmailRelay(env, PAYLOAD, async () => {
    publicCalls++;
    return json({ success: true });
  });
  assert.equal(res.status, 200);
  assert.equal(publicCalls, 0);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].headers.get("Content-Type"), "application/json");
  assert.equal(seen[0].headers.get("X-Relay-Secret"), null);
  assert.deepEqual(await seen[0].json(), PAYLOAD);
});

test("falls back to the public relay URL without a binding", async () => {
  console.log = () => {};
  const calls: [string, RequestInit][] = [];
  await sendToEmailRelay({}, PAYLOAD, async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return json({ success: true });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], EMAIL_RELAY_URL);
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0][1].body)), PAYLOAD);
  assert.deepEqual(calls[0][1].headers, { "Content-Type": "application/json" });
});

test("sends X-Relay-Secret only when EMAIL_RELAY_SECRET is set", async () => {
  console.log = () => {};
  let headers: Record<string, string> = {};
  await sendToEmailRelay({ EMAIL_RELAY_SECRET: "test-only-value" }, PAYLOAD, async (_u: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return json({ success: true });
  });
  assert.equal(headers["X-Relay-Secret"], "test-only-value");
});

test("onRequestPost: Turnstile still checked, binding used, same success response", async () => {
  console.log = () => {};
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    if (String(url).includes("turnstile")) return json({ success: true });
    return json({ success: true });
  }) as typeof fetch;
  let relayBody: unknown = null;
  const env = {
    TURNSTILE_SECRET_KEY: "test-turnstile",
    EMAIL_RELAY: { fetch: async (req: Request) => { relayBody = await req.json(); return json({ success: true }); } },
  };
  const res = await onRequestPost({
    request: formRequest({ ...PAYLOAD, phone: undefined, turnstileToken: "tok" }),
    env,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, message: "Mesajul a fost trimis! Vom reveni în 24h." });
  assert.deepEqual(urls, ["https://challenges.cloudflare.com/turnstile/v0/siteverify"]);
  assert.deepEqual(relayBody, PAYLOAD);
});

test("onRequestPost: failed Turnstile never reaches the relay", async () => {
  globalThis.fetch = (async () => json({ success: false })) as typeof fetch;
  let relayCalls = 0;
  const res = await onRequestPost({
    request: formRequest({ ...PAYLOAD, turnstileToken: "bad" }),
    env: { TURNSTILE_SECRET_KEY: "x", EMAIL_RELAY: { fetch: async () => { relayCalls++; return json({ success: true }); } } },
  });
  assert.equal(res.status, 403);
  assert.equal(relayCalls, 0);
  assert.deepEqual(await res.json(), { success: false, error: "Verificare de securitate eșuată." });
});

test("onRequestPost: relay failure keeps the same 500 response", async () => {
  console.log = () => {};
  const realErr = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = (async () => json({ success: true })) as typeof fetch;
    const res = await onRequestPost({
      request: formRequest({ ...PAYLOAD, turnstileToken: "tok" }),
      env: { TURNSTILE_SECRET_KEY: "x", EMAIL_RELAY: { fetch: async () => json({ error: "boom" }, 500) } },
    });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { success: false, error: "Nu am putut trimite mesajul. Încearcă din nou." });
  } finally {
    console.error = realErr;
  }
});

test("onRequestPost: missing fields / missing token unchanged", async () => {
  let r = await onRequestPost({ request: formRequest({ name: "A" }), env: {} });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { success: false, error: "Câmpuri obligatorii lipsă." });
  r = await onRequestPost({ request: formRequest(PAYLOAD), env: {} });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { success: false, error: "Verificare de securitate lipsă." });
});
