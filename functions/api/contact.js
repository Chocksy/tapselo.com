/**
 * Contact form handler — Cloudflare Pages Function
 *
 * 1. Validates Turnstile token (bot protection)
 * 2. Calls the email relay Worker to send via Cloudflare Email Routing
 *
 * Environment variables (set in Pages dashboard):
 *   TURNSTILE_SECRET_KEY - Cloudflare Turnstile secret
 */

const EMAIL_RELAY_URL = "https://tapselo-email-relay.ciocanel-razvan.workers.dev";

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
        JSON.stringify({ success: false, error: "Campuri obligatorii lipsa." }),
        { status: 400, headers }
      );
    }

    // Validate Turnstile token
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificare de securitate lipsa." }),
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
        JSON.stringify({ success: false, error: "Verificare de securitate esuata." }),
        { status: 403, headers }
      );
    }

    // Send email via the relay Worker
    const emailResult = await fetch(EMAIL_RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone: phone || "", message }),
    });

    const emailData = await emailResult.json();

    if (!emailResult.ok || !emailData.success) {
      console.error("Email relay error:", JSON.stringify(emailData));
      return new Response(
        JSON.stringify({ success: false, error: "Nu am putut trimite mesajul. Incearca din nou." }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Mesajul a fost trimis! Vom reveni in 24h." }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Contact form error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: "Eroare interna. Incearca din nou." }),
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
