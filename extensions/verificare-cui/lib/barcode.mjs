import { BARCODE_API } from "./constants.mjs";
import { escapeHtml } from "./labels.mjs";

export async function lookupBarcode(ean) {
  const code = String(ean ?? "").replace(/\D/g, "");
  if (code.length !== 13) {
    return { ok: false, error: "Introdu un cod EAN-13 de 13 cifre." };
  }
  const res = await fetch(`${BARCODE_API}/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return { ok: false, error: "Produsul nu este în nomenclatorul Tapselo." };
  if (!res.ok) return { ok: false, error: "Serviciul de cod de bare nu răspunde acum." };
  const data = await res.json();
  if (!data?.name) return { ok: false, error: "Răspuns neașteptat de la API." };
  return {
    ok: true,
    html: `<p><strong>${escapeHtml(data.name)}</strong></p>${
      data.category ? `<p>Categorie: ${escapeHtml(data.category)}</p>` : ""
    }<p>Cotă TVA: ${escapeHtml(String(data.vat_rate))}%</p>`,
  };
}
