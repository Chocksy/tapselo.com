/**
 * Contact form handler — Cloudflare Pages Function
 *
 * 1. Validates Turnstile token (bot protection)
 * 2. Calls the email relay Worker to send via Cloudflare Email Routing
 *
 * Environment variables / bindings (set in Pages dashboard):
 *   TURNSTILE_SECRET_KEY - Cloudflare Turnstile secret
 *   EMAIL_RELAY          - (optional) service binding -> tapselo-email-relay.
 *                          When present it is used instead of the public URL,
 *                          so the Worker's workers.dev route can be disabled.
 *   EMAIL_RELAY_SECRET   - (optional) shared secret sent as X-Relay-Secret.
 *                          Only needed for the fallback (URL + secret) setup.
 */

export const EMAIL_RELAY_URL = "https://tapselo-email-relay.ciocanel-razvan.workers.dev";

/**
 * POST the payload to the relay Worker. Prefers the EMAIL_RELAY service
 * binding (not reachable from the internet); falls back to the public URL so
 * the deploy order (code first, binding second) never breaks the form.
 */
export async function sendToEmailRelay(env, payload, fetchImpl = fetch) {
  const headers = { "Content-Type": "application/json" };
  if (env && env.EMAIL_RELAY_SECRET) headers["X-Relay-Secret"] = env.EMAIL_RELAY_SECRET;
  const init = { method: "POST", headers, body: JSON.stringify(payload) };

  if (env && env.EMAIL_RELAY && typeof env.EMAIL_RELAY.fetch === "function") {
    console.log("contact: email relay via service binding");
    // Host is ignored by service bindings; the path/method/body are what matter.
    return env.EMAIL_RELAY.fetch(new Request("https://email-relay.internal/", init));
  }
  console.log("contact: email relay via public URL");
  return fetchImpl(EMAIL_RELAY_URL, init);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await request.json();
    const { name, email, phone, message, turnstileToken } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Câmpuri obligatorii lipsă." }),
        { status: 400, headers }
      );
    }

    // Validate Turnstile token
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificare de securitate lipsă." }),
        { status: 400, headers }
      );
    }

    const turnstileResult = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      }
    );

    const turnstileData = await turnstileResult.json();
    if (!turnstileData.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificare de securitate eșuată." }),
        { status: 403, headers }
      );
    }

    // Send email via the relay Worker
    const emailResult = await sendToEmailRelay(env, {
      name,
      email,
      phone: phone || "",
      message,
    });

    const emailData = await emailResult.json();

    if (!emailResult.ok || !emailData.success) {
      console.error("Email relay error:", JSON.stringify(emailData));
      return new Response(
        JSON.stringify({ success: false, error: "Nu am putut trimite mesajul. Încearcă din nou." }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Mesajul a fost trimis! Vom reveni în 24h." }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Contact form error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: "Eroare internă. Încearcă din nou." }),
      { status: 500, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
