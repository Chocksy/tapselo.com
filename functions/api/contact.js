/**
 * Contact form handler — Cloudflare Pages Function
 *
 * Validates Turnstile token, then forwards the form data
 * to contact@tapselo.com via Cloudflare's MailChannels integration.
 *
 * Environment variables (set in Pages dashboard):
 *   TURNSTILE_SECRET_KEY - Cloudflare Turnstile secret
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
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

    // Send email via MailChannels (free for Cloudflare Workers)
    const emailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: "contact@tapselo.com", name: "Tapselo" }],
            reply_to: { email, name },
          },
        ],
        from: {
          email: "noreply@tapselo.com",
          name: "Tapselo Website",
        },
        subject: `[Tapselo.com] Mesaj nou de la ${name}`,
        content: [
          {
            type: "text/plain",
            value: [
              `Nume: ${name}`,
              `Email: ${email}`,
              phone ? `Telefon: ${phone}` : null,
              ``,
              `Mesaj:`,
              message,
              ``,
              `---`,
              `Trimis de pe tapselo.com`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error("MailChannels error:", errText);
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
    console.error("Contact form error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Eroare interna. Incearca din nou." }),
      { status: 500, headers }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
