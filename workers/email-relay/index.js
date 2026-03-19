/**
 * Email relay Worker — receives form data via POST, sends email
 * using Cloudflare's send_email binding to contact@tapselo.com.
 *
 * Deployed as a standalone Worker with send_email binding.
 * Called from the Pages Function via Service Binding.
 */
import { EmailMessage } from "cloudflare:email";

export default {
  async fetch(request, env) {
    // Only allow POST
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const { name, email, phone, message } = await request.json();

      if (!name || !email || !message) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }

      // Build raw MIME email
      const body = [
        `Nume: ${name}`,
        `Email: ${email}`,
        phone ? `Telefon: ${phone}` : null,
        ``,
        `Mesaj:`,
        message,
        ``,
        `---`,
        `Trimis de pe tapselo.com la ${new Date().toISOString()}`,
      ].filter(Boolean).join("\r\n");

      const rawEmail = [
        `From: Tapselo Website <noreply@tapselo.com>`,
        `To: contact@tapselo.com`,
        `Reply-To: ${name} <${email}>`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(`[Tapselo.com] Mesaj de la ${name}`)))}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: quoted-printable`,
        `Date: ${new Date().toUTCString()}`,
        ``,
        body,
      ].join("\r\n");

      const msg = new EmailMessage("noreply@tapselo.com", "contact@tapselo.com", rawEmail);
      await env.SEND_EMAIL.send(msg);

      return Response.json({ success: true });
    } catch (err) {
      console.error("Email relay error:", err.message, err.stack);
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
