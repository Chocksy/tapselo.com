/**
 * Email relay Worker — receives form data, sends email
 * via Cloudflare send_email binding → ciocanel.razvan@gmail.com
 *
 * Only meant to be called server-side by the tapselo-com Pages Function
 * (functions/api/contact.js), preferably through a service binding with the
 * workers.dev route disabled (see wrangler.toml). No CORS: browsers must
 * never call this directly; the Turnstile check lives in contact.js.
 *
 * Optional fallback hardening: if the RELAY_SHARED_SECRET Worker secret is
 * set, every request must carry a matching X-Relay-Secret header.
 */
import { EmailMessage } from "cloudflare:email";

function secretMatches(provided, expected) {
  const enc = new TextEncoder();
  const a = enc.encode(provided || "");
  const b = enc.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (env.RELAY_SHARED_SECRET &&
        !secretMatches(request.headers.get("X-Relay-Secret"), env.RELAY_SHARED_SECRET)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const { name, email, phone, message } = await request.json();

      if (!name || !email || !message) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }

      const msgId = `<${crypto.randomUUID()}@tapselo.com>`;
      const subject = `[Tapselo.com] Mesaj de la ${name}`;
      const body = [
        `Nume: ${name}`,
        `Email: ${email}`,
        phone ? `Telefon: ${phone}` : "",
        "",
        "Mesaj:",
        message,
        "",
        "---",
        `Trimis de pe tapselo.com la ${new Date().toISOString()}`,
      ].filter((l) => l !== null).join("\r\n");

      const rawEmail = [
        "MIME-Version: 1.0",
        `Message-ID: ${msgId}`,
        `Date: ${new Date().toUTCString()}`,
        `From: Tapselo Website <noreply@tapselo.com>`,
        `To: ciocanel.razvan@gmail.com`,
        `Reply-To: ${email}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        body,
      ].join("\r\n");

      const msg = new EmailMessage(
        "noreply@tapselo.com",
        "ciocanel.razvan@gmail.com",
        rawEmail
      );
      await env.SEND_EMAIL.send(msg);

      return Response.json({ success: true });
    } catch (err) {
      console.error("Email relay error:", err.message, err.stack);
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
