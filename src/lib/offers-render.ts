// HTML for /o/{slug}, the public offers page of one store.
// Pure module (no imports, no DOM, no fetch): functions/o/[slug].ts calls it, and
// tests/offers-render.test.ts runs it under plain node. Every store and product text is escaped.

// Shape returned by public.public_offers(p_slug) (see the pos repo plan, "DB contract").
export interface OffersPayload {
  store: {
    name: string | null;
    slug: string | null;
    company_name: string | null;
    address: string | null;
    phone: string | null;
  };
  promos: OfferPromo[] | null;
  announcements: OfferAnnouncement[] | null;
  signup_enabled: boolean | null;
}

export interface OfferPromo {
  product_id: string;
  name: string | null;
  emoji: string | null;
  unit: string | null;
  price_cents: number | null;
  promo_price_cents: number | null;
  prior_lowest_cents: number | null;
  prior_days: number | null;
  promo_to: string | null;
}

export interface OfferAnnouncement {
  title: string | null;
  body: string | null;
  ends_on: string | null;
}

const SITE = "https://tapselo.com";
const OG_IMAGE = `${SITE}/og-image.jpg`;

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 1250 -> "12,50 lei"; null when the value is not a usable number.
export function formatLei(cents: unknown): string | null {
  const n = Number(cents);
  if (cents === null || cents === undefined || cents === "" || !Number.isFinite(n)) return null;
  return `${(n / 100).toFixed(2).replace(".", ",")} lei`;
}

// "2026-10-05" -> "05.10.2026". Plain string work, no timezone shifts.
export function formatDate(iso: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

// Romanian: "10 zile", "30 de zile" (the "de" goes in from 20 up, by the last two digits).
export function daysLabel(n: number): string {
  const r = n % 100;
  return n >= 20 && (r === 0 || r >= 20) ? `${n} de zile` : `${n} zile`;
}

function unitLabel(unit: string | null): string {
  const u = (unit ?? "").trim();
  return u ? `lei / ${u}` : "lei";
}

// Escaped text with line breaks kept.
function multiline(v: unknown): string {
  return escapeHtml(v).replace(/\r?\n/g, "<br />");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function storeName(p: OffersPayload): string {
  return (p.store?.name ?? "").trim() || "Magazinul";
}

// og:description: the first promos as plain text (escaped later, at attribute level).
export function offersDescription(p: OffersPayload): string {
  const name = storeName(p);
  const promos = p.promos ?? [];
  if (promos.length > 0) {
    const parts = promos.slice(0, 3).map((x) => {
      const price = formatLei(x.promo_price_cents);
      return price ? `${(x.name ?? "").trim()} ${price}` : (x.name ?? "").trim();
    });
    const more = promos.length > 3 ? ` si inca ${promos.length - 3}` : "";
    return truncate(`Oferte la ${name}: ${parts.join(", ")}${more}.`, 200);
  }
  const ann = (p.announcements ?? []).find((a) => (a.title ?? "").trim());
  if (ann) return truncate(`${name}: ${(ann.title ?? "").trim()}`, 200);
  return `Ofertele de azi la ${name}.`;
}

// ---------- shared page frame ----------

interface Frame {
  title: string;
  description: string;
  canonical: string;
  storeLabel: string;
  body: string;
  footer: string;
}

function page(f: Frame): string {
  const t = escapeHtml(f.title);
  const d = escapeHtml(f.description);
  const c = escapeHtml(f.canonical);
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${c}" />
<meta name="theme-color" content="#0f172a" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${c}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="ro_RO" />
<meta property="og:site_name" content="Tapselo" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Instrument+Serif:ital@1&display=swap" />
<style>${CSS}</style>
</head>
<body>
<header class="hdr"><div class="wrap"><p class="hdr-store">${escapeHtml(f.storeLabel)}</p></div></header>
<main class="main"><div class="wrap">
${f.body}
</div></main>
<footer class="ftr"><div class="wrap">
${f.footer}
<p class="made">Pagina realizata cu <a href="/">Tapselo</a>, programul de casa al magazinului.</p>
</div></footer>
</body>
</html>
`;
}

// Same tokens and pub-* look as src/components/PublicShell.astro (the /c and /p pages).
const CSS = `
:root{--primary:#0f172a;--accent:#2563eb;--accent-hover:#1d4ed8;--accent-light:#dbeafe;--cash:#10b981;--cash-light:#d1fae5;--ticket-light:#fef3c7;--surface:#f1f5f9;--white:#fff;--text:#0f172a;--text-2:#475569;--muted:#94a3b8;--border:#cbd5e1;--border-light:#e2e8f0;--danger:#b91c1c}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:"Geist","Geist Variable",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:var(--surface);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
.wrap{max-width:48rem;margin:0 auto;padding:0 1rem}
.hdr{background:var(--primary)}
.hdr .wrap{padding:1rem 1.25rem}
.hdr-store{margin:0;font-size:1.125rem;font-weight:700;color:#fff}
.main{min-height:70vh;padding:1.5rem 0}
@media (min-width:640px){.main{padding:2.5rem 0}}
.pub-title{margin:0;font-family:"Instrument Serif",Georgia,"Times New Roman",serif;font-style:italic;font-weight:400;font-size:2.25rem;line-height:1.15;color:var(--primary);letter-spacing:-.01em}
.pub-text{margin:.75rem 0 0;font-size:1.125rem;line-height:1.6;color:var(--text-2)}
.pub-card{background:var(--white);border:1px solid var(--border-light);border-radius:1rem;padding:1.5rem 1.25rem}
@media (min-width:640px){.pub-card{padding:2rem}}
.sec{margin-top:1.75rem}
.sec-title{margin:0 0 .75rem;font-size:1.25rem;font-weight:700;color:var(--text)}
.ann{background:var(--ticket-light);border:2px solid #fcd34d;border-radius:1rem;padding:1.25rem;margin-top:.75rem}
.ann h3{margin:0;font-size:1.25rem;font-weight:700;color:var(--text)}
.ann p{margin:.5rem 0 0;font-size:1.0625rem;color:var(--text-2)}
.ann .until{font-size:.9375rem;font-weight:600;color:#92400e}
.grid{display:grid;gap:.75rem;grid-template-columns:1fr}
@media (min-width:720px){.grid{grid-template-columns:1fr 1fr}}
.promo{display:flex;gap:1rem;align-items:flex-start;background:var(--white);border:1px solid var(--border-light);border-radius:1rem;padding:1.25rem}
.emoji{flex:none;width:3.5rem;height:3.5rem;display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--surface);border-radius:.75rem}
.promo-body{min-width:0;flex:1}
.promo h3{margin:0;font-size:1.25rem;line-height:1.3;font-weight:700;color:var(--text);overflow-wrap:anywhere}
.prices{margin:.5rem 0 0;display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .75rem}
.old{font-size:1.0625rem;color:var(--muted);text-decoration:line-through}
.new{font-size:1.75rem;font-weight:800;color:#047857;line-height:1.2}
.unit{font-size:1rem;font-weight:600;color:var(--text-2)}
.prior{margin:.5rem 0 0;font-size:.9375rem;color:var(--text-2)}
.valid{margin:.25rem 0 0;font-size:.9375rem;font-weight:600;color:var(--text)}
.empty{text-align:center}
.cta{margin-top:1.75rem;text-align:center}
.cta p{margin:0 0 1rem;font-size:1.25rem;font-weight:700;color:var(--text)}
.pub-btn{display:block;width:100%;min-height:4rem;padding:1rem;font-size:1.375rem;font-weight:700;line-height:2rem;color:#fff;background:var(--accent);border-radius:.75rem;text-decoration:none;text-align:center}
.pub-btn:hover{background:var(--accent-hover)}
.ftr{padding:2rem 0}
.ftr .wrap{padding:0 1.25rem;text-align:center;font-size:.9375rem;color:var(--text-2)}
.ftr p{margin:.25rem 0}
.ftr strong{color:var(--text)}
.ftr .links{margin-top:.75rem}
.ftr .links a{font-weight:700}
.made{margin-top:1.25rem !important;font-size:.875rem}
.made a{font-weight:700;text-decoration:none}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

// ---------- offers page ----------

function renderAnnouncement(a: OfferAnnouncement): string {
  const title = (a.title ?? "").trim();
  if (!title) return "";
  const body = (a.body ?? "").trim();
  const until = formatDate(a.ends_on);
  return `<article class="ann">
<h3>${escapeHtml(title)}</h3>
${body ? `<p>${multiline(body)}</p>` : ""}
${until ? `<p class="until">Pana pe ${escapeHtml(until)}</p>` : ""}
</article>`;
}

function renderPromo(x: OfferPromo): string {
  const name = (x.name ?? "").trim() || "Produs";
  const emoji = (x.emoji ?? "").trim() || "🏷️";
  const promo = formatLei(x.promo_price_cents);
  // HG 947/2000 art. 4^1: a reduction is shown against the lowest price of the
  // last 30 (10) days, not the current list price.
  const refCents = x.prior_lowest_cents ?? x.price_cents;
  const regular = formatLei(refCents);
  const showOld = regular !== null && promo !== null && Number(refCents) > Number(x.promo_price_cents);
  const prior = formatLei(x.prior_lowest_cents);
  const days = Number(x.prior_days);
  const until = formatDate(x.promo_to);
  // The price already carries " lei"; the unit line says "lei / kg".
  const promoNumber = promo ? promo.replace(/ lei$/, "") : null;
  return `<article class="promo">
<div class="emoji" aria-hidden="true">${escapeHtml(emoji)}</div>
<div class="promo-body">
<h3>${escapeHtml(name)}</h3>
<p class="prices">
${showOld ? `<s class="old" aria-label="Pret vechi ${escapeHtml(regular)}">${escapeHtml(regular)}</s>` : ""}
${promoNumber ? `<span class="new">${escapeHtml(promoNumber)}</span> <span class="unit">${escapeHtml(unitLabel(x.unit))}</span>` : ""}
</p>
${prior && Number.isFinite(days) && days > 0 ? `<p class="prior">Cel mai mic pret in ultimele ${escapeHtml(daysLabel(days))}: ${escapeHtml(prior)}</p>` : ""}
${until ? `<p class="valid">Valabil pana pe ${escapeHtml(until)}</p>` : ""}
</div>
</article>`;
}

// `slug` must already be validated (lowercase a-z0-9 and dashes); it is still escaped.
export function renderOffersPage(p: OffersPayload, slug: string): string {
  const name = storeName(p);
  const promos = (p.promos ?? []).filter(Boolean);
  const anns = (p.announcements ?? []).filter((a) => a && (a.title ?? "").trim());
  const s = encodeURIComponent(slug);

  const parts: string[] = [];
  parts.push(`<h1 class="pub-title">Oferte la ${escapeHtml(name)}</h1>`);

  if (anns.length > 0) {
    parts.push(`<section class="sec" aria-label="Anunturi">${anns.map(renderAnnouncement).join("\n")}</section>`);
  }

  if (promos.length > 0) {
    parts.push(`<section class="sec" aria-labelledby="promo-title">
<h2 class="sec-title" id="promo-title">Produse la reducere</h2>
<div class="grid">
${promos.map(renderPromo).join("\n")}
</div>
</section>`);
  } else if (anns.length === 0) {
    parts.push(`<div class="sec pub-card empty"><p class="pub-text" style="margin:0">Acum nu sunt oferte. Revino in curand.</p></div>`);
  }

  if (p.signup_enabled) {
    parts.push(`<section class="cta pub-card">
<p>Vrei oferte pe email sau WhatsApp?</p>
<a class="pub-btn" href="/c/${escapeHtml(s)}">Inscrie-te</a>
</section>`);
  }

  const st = p.store ?? ({} as OffersPayload["store"]);
  const company = (st.company_name ?? "").trim();
  const address = (st.address ?? "").trim();
  const phone = (st.phone ?? "").trim();
  const tel = phone.replace(/[^0-9+]/g, "");
  const footer = [
    `<p><strong>${escapeHtml(company || name)}</strong></p>`,
    address ? `<p>${escapeHtml(address)}</p>` : "",
    phone ? `<p>Telefon: ${tel ? `<a href="tel:${escapeHtml(tel)}">${escapeHtml(phone)}</a>` : escapeHtml(phone)}</p>` : "",
    `<p class="links"><a href="/p/${escapeHtml(s)}">Cum folosim datele clientilor</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return page({
    title: `Oferte ${name}`,
    description: offersDescription(p),
    canonical: `${SITE}/o/${s}`,
    storeLabel: name,
    body: parts.join("\n"),
    footer,
  });
}

// Unknown slug, page turned off, or the service is not reachable.
export function renderNotFoundPage(): string {
  return page({
    title: "Pagina nu a fost gasita - Tapselo",
    description: "Pagina de oferte nu exista sau nu este activa.",
    canonical: `${SITE}/`,
    storeLabel: "Oferte",
    body: `<div class="pub-card">
<h1 class="pub-title">Nu am gasit ofertele</h1>
<p class="pub-text">Magazinul nu are o pagina de oferte activa la aceasta adresa. Verifica linkul sau intreaba la casa magazinului.</p>
</div>`,
    footer: "",
  });
}
