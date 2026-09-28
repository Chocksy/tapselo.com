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
  // Hero text, already escaped by the caller. The kicker and subtitle are optional.
  kicker: string;
  heading: string;
  headingClass?: string;
  sub: string;
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
<meta name="theme-color" content="#14532d" />
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..900&family=Instrument+Serif:ital@1&display=swap" />
<style>${CSS}</style>
</head>
<body>
<header class="hero"><div class="wrap">
<p class="store">${escapeHtml(f.storeLabel)}</p>
${f.kicker ? `<p class="kicker">${f.kicker}</p>` : ""}
<h1${f.headingClass ? ` class="${f.headingClass}"` : ""}>${f.heading}</h1>
${f.sub ? `<p class="hero-sub">${f.sub}</p>` : ""}
</div></header>
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

// Flyer look: green hero, yellow price tags, red percent badges.
const CSS = `
:root{--green:#14532d;--green-2:#166534;--green-soft:#dcfce7;--yellow:#facc15;--red:#dc2626;--ink:#0f172a;--text-2:#475569;--muted:#94a3b8;--line:#e2e8f0;--bg:#f6f7f2}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:"Geist","Geist Variable",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--green-2)}
.wrap{max-width:52rem;margin:0 auto;padding:0 1rem}
.hero{position:relative;overflow:hidden;background:var(--green);color:#fff;padding:1.25rem 0 3.25rem}
.hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) 1.5px,transparent 1.5px);background-size:18px 18px;-webkit-mask-image:linear-gradient(115deg,transparent 45%,#000 80%);mask-image:linear-gradient(115deg,transparent 45%,#000 80%)}
.hero::after{content:"";position:absolute;right:-5rem;bottom:-8rem;width:13rem;height:13rem;border-radius:50%;background:var(--yellow)}
.hero .wrap{position:relative;z-index:1}
.store{display:flex;align-items:center;gap:.5rem;margin:0;font-size:1rem;font-weight:700}
.store::before{content:"";flex:none;width:.625rem;height:.625rem;border-radius:50%;background:var(--yellow)}
.kicker{margin:1.75rem 0 0;font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:1.75rem;line-height:1;color:#fff}
.hero h1{margin:.125rem 0 0;font-size:clamp(3rem,14vw,5rem);line-height:.95;font-weight:900;letter-spacing:-.035em;color:var(--yellow);text-transform:uppercase}
.hero h1.h1-sm{margin-top:1.75rem;font-size:clamp(2.25rem,10vw,3.5rem);line-height:1;max-width:36rem}
.hero-sub{margin:.75rem 0 0;max-width:15rem;font-size:1.0625rem;color:#dcfce7}
@media (min-width:640px){.hero::after{right:-4rem;bottom:-10rem;width:20rem;height:20rem}.hero-sub{max-width:24rem}}
.main{position:relative;z-index:2;margin-top:-1.75rem;min-height:40vh;padding-bottom:2rem}
.sec-title{display:flex;align-items:center;gap:.75rem;margin:2rem 0 .875rem;font-size:1.375rem;font-weight:800;letter-spacing:-.01em}
.sec-title::after{content:"";flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 8px,transparent 8px 14px)}
.card{background:#fff;border-radius:1.25rem;padding:1.5rem 1.25rem;box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 20px -14px rgba(15,23,42,.35)}
.card p{margin:0;font-size:1.125rem;color:var(--text-2)}
.empty{text-align:center}
.ann{position:relative;display:flex;gap:1rem;background:var(--yellow);border-radius:1rem;padding:1.125rem 1.25rem;box-shadow:0 10px 24px -12px rgba(20,83,45,.45);margin-top:.75rem}
.ann::before,.ann::after{content:"";position:absolute;top:50%;width:1rem;height:1rem;margin-top:-.5rem;border-radius:50%;background:var(--bg)}
.ann::before{left:-.5rem}
.ann::after{right:-.5rem}
.ann-ico{flex:none;width:2.75rem;height:2.75rem;display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:#fff;border-radius:50%}
.ann-body{min-width:0}
.ann h3{margin:0;font-size:1.1875rem;line-height:1.25;font-weight:800;overflow-wrap:anywhere}
.ann p{margin:.375rem 0 0;font-size:1rem;color:#422006}
.ann .until{display:inline-block;margin-top:.625rem;padding:.125rem .625rem;font-size:.8125rem;font-weight:700;color:#fff;background:var(--green);border-radius:999px}
.grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))}
@media (min-width:720px){.grid{gap:1rem;grid-template-columns:repeat(3,1fr)}}
.promo{position:relative;display:flex;flex-direction:column;background:#fff;border-radius:1.25rem;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 20px -14px rgba(15,23,42,.35)}
.art{position:relative;display:flex;align-items:center;justify-content:center;height:7.5rem;font-size:3.75rem;background:var(--green-soft)}
.promo:nth-child(3n+2) .art{background:#fef3c7}
.promo:nth-child(3n+3) .art{background:#ffe4e6}
.badge{position:absolute;top:.625rem;left:.625rem;display:flex;align-items:center;justify-content:center;width:3.25rem;height:3.25rem;border-radius:50%;background:var(--red);color:#fff;font-size:1rem;font-weight:900;letter-spacing:-.02em;transform:rotate(-12deg);box-shadow:0 0 0 3px #fff}
.promo-body{display:flex;flex-direction:column;flex:1;padding:.875rem .875rem 1rem}
.promo h3{margin:0;font-size:1.0625rem;line-height:1.25;font-weight:700;overflow-wrap:anywhere}
.old{margin:.625rem 0 0;font-size:.9375rem;color:var(--muted)}
.old s{text-decoration-color:var(--red);text-decoration-thickness:2px}
.tag{display:inline-flex;white-space:nowrap;align-items:baseline;gap:.25rem;align-self:flex-start;margin:.25rem 0 0;padding:.25rem .625rem .25rem .5rem;background:var(--yellow);border-radius:.5rem}
.tag .new{font-size:clamp(1.5rem,7vw,1.875rem);line-height:1.1;font-weight:900;letter-spacing:-.03em;color:var(--ink)}
.tag .unit{font-size:.8125rem;font-weight:700;color:#422006}
.prior{margin:.625rem 0 0;font-size:.8125rem;line-height:1.35;color:var(--text-2)}
.valid{margin:auto 0 0;padding-top:.625rem;font-size:.8125rem;font-weight:700;color:var(--green-2)}
.cta{position:relative;overflow:hidden;margin-top:2rem;padding:1.75rem 1.25rem;border-radius:1.25rem;background:var(--green);color:#fff;text-align:center}
.cta::before{content:"";position:absolute;left:-4rem;top:-4rem;width:10rem;height:10rem;border-radius:50%;background:rgba(250,204,21,.18)}
.cta p{position:relative;margin:0;font-size:1.375rem;font-weight:800;line-height:1.25}
.cta small{position:relative;display:block;margin:.375rem 0 1.125rem;font-size:1rem;color:#bbf7d0}
.btn{position:relative;display:block;min-height:3.75rem;padding:.875rem 1rem;font-size:1.25rem;font-weight:800;line-height:2rem;color:var(--ink);background:var(--yellow);border-radius:.875rem;text-decoration:none}
.btn:hover{background:#fde047}
.ftr{padding:1.5rem 0 2.5rem;text-align:center;font-size:.9375rem;color:var(--text-2)}
.ftr p{margin:.25rem 0}
.ftr strong{color:var(--ink)}
.ftr .links a{font-weight:700}
.made{margin-top:1.25rem !important;font-size:.8125rem;color:var(--muted)}
.made a{color:var(--text-2);font-weight:700;text-decoration:none}
:focus-visible{outline:3px solid var(--yellow);outline-offset:2px}
`;

// ---------- offers page ----------

function renderAnnouncement(a: OfferAnnouncement): string {
  const title = (a.title ?? "").trim();
  if (!title) return "";
  const body = (a.body ?? "").trim();
  const until = formatDate(a.ends_on);
  return `<article class="ann">
<div class="ann-ico" aria-hidden="true">📣</div>
<div class="ann-body">
<h3>${escapeHtml(title)}</h3>
${body ? `<p>${multiline(body)}</p>` : ""}
${until ? `<span class="until">Pana pe ${escapeHtml(until)}</span>` : ""}
</div>
</article>`;
}

function renderPromo(x: OfferPromo): string {
  const name = (x.name ?? "").trim() || "Produs";
  const emoji = (x.emoji ?? "").trim() || "🏷️";
  const promo = formatLei(x.promo_price_cents);
  // HG 947/2000 art. 4^1: a reduction is shown against the lowest price of the
  // last 30 (10) days, not the current list price. The percent uses the same reference.
  const refCents = x.prior_lowest_cents ?? x.price_cents;
  const regular = formatLei(refCents);
  const showOld = regular !== null && promo !== null && Number(refCents) > Number(x.promo_price_cents);
  const percent = showOld
    ? Math.floor(((Number(refCents) - Number(x.promo_price_cents)) * 100) / Number(refCents))
    : 0;
  const prior = formatLei(x.prior_lowest_cents);
  const days = Number(x.prior_days);
  const until = formatDate(x.promo_to);
  // The price already carries " lei"; the unit line says "lei / kg".
  const promoNumber = promo ? promo.replace(/ lei$/, "") : null;
  return `<article class="promo">
<div class="art" aria-hidden="true">${escapeHtml(emoji)}${percent >= 1 ? `<span class="badge">-${percent}%</span>` : ""}</div>
<div class="promo-body">
<h3>${escapeHtml(name)}</h3>
${showOld ? `<p class="old"><s aria-label="Pret vechi ${escapeHtml(regular)}">${escapeHtml(regular)}</s></p>` : ""}
${promoNumber ? `<p class="tag"><span class="new">${escapeHtml(promoNumber)}</span><span class="unit">${escapeHtml(unitLabel(x.unit))}</span></p>` : ""}
${prior && Number.isFinite(days) && days > 0 ? `<p class="prior">Cel mai mic pret in ultimele ${escapeHtml(daysLabel(days))}: ${escapeHtml(prior)}</p>` : ""}
${until ? `<p class="valid">Pana pe ${escapeHtml(until)}</p>` : ""}
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

  if (anns.length > 0) {
    parts.push(`<section aria-label="Anunturi">${anns.map(renderAnnouncement).join("\n")}</section>`);
  }

  if (promos.length > 0) {
    parts.push(`<section aria-labelledby="promo-title">
<h2 class="sec-title" id="promo-title">Produse la reducere</h2>
<div class="grid">
${promos.map(renderPromo).join("\n")}
</div>
</section>`);
  } else if (anns.length === 0) {
    parts.push(`<div class="card empty"><p>Acum nu sunt oferte. Revino in curand.</p></div>`);
  }

  if (p.signup_enabled) {
    parts.push(`<section class="cta">
<p>Vrei ofertele pe email sau WhatsApp?</p>
<small>Te anuntam cand apar preturi noi.</small>
<a class="btn" href="/c/${escapeHtml(s)}">Inscrie-te</a>
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
    kicker: "Ofertele de azi",
    heading: "Oferte",
    sub: "Preturi mici la produsele de mai jos, doar in magazin.",
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
    kicker: "",
    heading: "Nu am gasit ofertele",
    headingClass: "h1-sm",
    sub: "",
    body: `<div class="card">
<p>Magazinul nu are o pagina de oferte activa la aceasta adresa. Verifica linkul sau intreaba la casa magazinului.</p>
</div>`,
    footer: "",
  });
}
