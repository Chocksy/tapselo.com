import { escapeHtml, renderShell } from "../../generators/page.ts";
import type { RenderedSign, ShopDetails } from "./types.ts";

const SIGN_FONT_CSS = `
@font-face{font-family:"SignRo";font-style:normal;font-weight:400 700;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5/latin-ext-400-normal.woff2) format("woff2")}
body,.sheet{font-family:"SignRo",Arial,Helvetica,sans-serif}
.sign-page{page-break-after:always;padding:4mm 0}
.sign-page:last-child{page-break-after:auto}
.sign-box{border:2px solid #0f172a;padding:8mm 10mm;min-height:120mm;display:flex;flex-direction:column;justify-content:center}
.sign-box.sign-emphasis{border-width:3px}
.sign-h{margin:0 0 4mm;font-size:14pt;font-weight:700;text-align:center;line-height:1.35}
.sign-h.sign-lg{font-size:18pt;text-transform:uppercase}
.sign-p{margin:0 0 2.5mm;font-size:11pt;line-height:1.45;text-align:center}
.sign-meta .sign-p{font-size:10pt}
.sign-center{text-align:center}
.sign-symbol{font-size:28pt;margin:0 0 4mm}
.muted{color:#475569;font-size:9.5pt}
.sign-logo{display:block;max-height:22mm;max-width:60mm;margin:0 auto 6mm;object-fit:contain}
@media print{.sign-page{page-break-after:always}}
`;

function logoHtml(shop: ShopDetails): string {
  if (!shop.logoDataUrl) return "";
  return `<img class="sign-logo" src="${escapeHtml(shop.logoDataUrl)}" alt="" />`;
}

function signPage(sign: RenderedSign, shop: ShopDetails): string {
  return `<section class="sign-page" data-sign="${escapeHtml(sign.id)}">
${logoHtml(shop)}
${sign.bodyHtml}
</section>`;
}

export function renderSignsPrintHtml(signs: RenderedSign[], shop: ShopDetails): string {
  const landscape = signs.some((s) => s.landscape);
  const body = signs.map((s) => signPage(s, shop)).join("\n");
  return renderShell({
    kind: "afise_obligatorii",
    title: "Afișe obligatorii magazin",
    expiresAt: null,
    body,
    css: SIGN_FONT_CSS,
    landscape,
    margin: "12mm",
    local: true,
  });
}

/** Inline preview fragment (no shell). */
export function renderSignPreviewHtml(sign: RenderedSign, shop: ShopDetails): string {
  return `<article class="ao-preview-card" data-sign="${escapeHtml(sign.id)}">
${logoHtml(shop)}
${sign.bodyHtml}
</article>`;
}
