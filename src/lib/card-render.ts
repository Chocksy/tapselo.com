// HTML for /card/{token}, the public loyalty card page of one customer.
// Pure module (no DOM, no fetch): functions/card/[token].ts calls it, and
// tests/card-render.test.ts runs it under plain node. Every value from the payload is escaped.

import { ean13Svg } from "./ean13.ts";
import { escapeHtml } from "./offers-render.ts";

/** Shape returned by public.public_card(p_token) (pos repo spec 2026-10-19-card-link-and-page). */
export interface CardPayload {
  shop_name: string | null;
  first_name: string | null;
  card_code: string | null;
  levels_on: boolean | null;
  level_name: string | null;
  level_percent: number | string | null;
  points: number | string | null;
  next_name: string | null;
  next_min_points: number | string | null;
  /** Optional: the next level's percent, shown as "(5%)". Not in the first contract; rendered only when sent. */
  next_percent?: number | string | null;
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

const SITE = "https://tapselo.com";

/** from/to: bar and theme colours; metal: the brushed-metal card face (design pick A1). */
interface LevelLook {
  from: string;
  to: string;
  metal: string;
}

const LOOKS: Record<string, LevelLook> = {
  bronz: { from: "#7c2d12", to: "#c2410c", metal: "#7c2d12,#fdba74 30%,#9a3412 52%,#fed7aa 66%,#431407" },
  argint: { from: "#4b5563", to: "#9ca3af", metal: "#9ca3af,#f3f4f6 28%,#a1a1aa 46%,#e5e7eb 62%,#71717a" },
  aur: { from: "#854d0e", to: "#ca8a04", metal: "#a16207,#fde68a 30%,#ca8a04 50%,#fef3c7 64%,#854d0e" },
};
const NEUTRAL: LevelLook = { from: "#1e293b", to: "#475569", metal: "#1e293b,#64748b 40%,#334155 60%,#475569" };

/** Card colours by level name (case and diacritics ignored); any other name is neutral slate. */
export function levelLook(name: unknown): LevelLook {
  const key = String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  return LOOKS[key] ?? NEUTRAL;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 3 -> "3", 2.5 -> "2,5" (Romanian decimal comma). */
export function formatPct(v: unknown): string | null {
  const n = num(v);
  if (n === null) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/** Romanian plural: 1 punct, 19 puncte, 20 de puncte, 101 puncte, 1100 de puncte. */
export function pointsLabel(n: number): string {
  if (n === 1) return "1 punct";
  const r = n % 100;
  return n > 0 && (r === 0 || r >= 20) ? `${n} de puncte` : `${n} puncte`;
}

function page(title: string, themeColor: string, body: string): string {
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="no-referrer" />
<meta name="theme-color" content="${escapeHtml(themeColor)}" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Card client" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&display=swap" />
<style>${CSS}</style>
</head>
<body>
<main class="wrap">
${body}
<p class="made">Card realizat cu <a href="${SITE}/">Tapselo</a></p>
</main>
</body>
</html>
`;
}

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#f1f3f6;line-height:1.45;-webkit-font-smoothing:antialiased}
.wrap{max-width:26rem;margin:0 auto;padding:1.25rem 1rem calc(2rem + env(safe-area-inset-bottom))}
.shop{margin:.25rem 0 1rem;text-align:center;font-size:1.25rem;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
.card{position:relative;overflow:hidden;border-radius:1.5rem;padding:1.125rem 1.125rem 1.25rem;color:#111;background:linear-gradient(115deg,var(--metal));box-shadow:0 18px 36px -20px rgba(15,23,42,.6),inset 0 1px 0 rgba(255,255,255,.5)}
.card.neutral{color:#fff}
.card::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.5) 45%,transparent 60%);transform:translateX(-120%);animation:sheen 3.6s ease-in-out infinite}
@keyframes sheen{60%,100%{transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){.card::after{animation:none;display:none}}
.coins{display:flex;align-items:center;gap:.625rem;margin-bottom:.875rem}
.coin{flex:none;width:2.75rem;height:2.75rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9375rem;color:#111;background:linear-gradient(135deg,var(--metal));box-shadow:inset 0 -3px 0 rgba(0,0,0,.18),0 4px 10px rgba(15,23,42,.15)}
.coin.next{opacity:.45}
.coins .track{flex:1;font-size:.875rem;color:#475569;text-align:center}
.card-top{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;margin:0 .125rem .875rem}
.lvl{margin:0;font-size:1.375rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.who{margin:0;font-size:1rem;font-weight:600;opacity:.92;overflow-wrap:anywhere;text-align:right}
.code{position:relative;z-index:1;background:#fff;border-radius:1rem;padding:1rem .75rem .75rem}
.code .ean{display:block;width:100%;height:auto}
.code .plain{margin:.5rem 0;text-align:center;color:#0f172a;font:700 1.5rem/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em}
.scan{margin:.625rem 0 0;text-align:center;font-size:.875rem;opacity:.92}
.box{margin-top:1rem;background:#fff;border-radius:1.25rem;padding:1.125rem 1.125rem 1.25rem;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.pts{margin:0;font-size:1.75rem;font-weight:800;letter-spacing:-.02em}
.bar{margin:.75rem 0 .625rem;height:.625rem;border-radius:999px;background:#e5e7eb;overflow:hidden}
.bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--from),var(--to))}
.next{margin:0;font-size:1rem;color:#334155}
.tip{margin:1rem .25rem 0;text-align:center;font-size:.9375rem;color:#475569}
.made{margin:1.5rem 0 0;text-align:center;font-size:.8125rem;color:#94a3b8}
.made a{color:#64748b;font-weight:700;text-decoration:none}
.nf{margin-top:3rem;background:#fff;border-radius:1.25rem;padding:1.5rem 1.25rem;text-align:center}
.nf h1{margin:0 0 .5rem;font-size:1.5rem;font-weight:800}
.nf p{margin:0;font-size:1.0625rem;color:#475569}
`;

export function renderCardPage(p: CardPayload): string {
  const shop = (p.shop_name ?? "").trim() || "Magazinul";
  const first = (p.first_name ?? "").trim();
  const code = String(p.card_code ?? "").trim();
  const levelsOn = p.levels_on === true;
  const levelName = (p.level_name ?? "").trim();
  const pct = formatPct(p.level_percent);
  const look = levelsOn && levelName ? levelLook(levelName) : NEUTRAL;
  const vars = `--from:${look.from};--to:${look.to};--metal:${look.metal}`;

  const label = levelsOn && levelName ? `${levelName}${pct ? ` ${pct}%` : ""}` : "Card de client";
  const svg = ean13Svg(code);
  const codeHtml = svg ?? `<p class="plain">${escapeHtml(code)}</p>`;

  let box = "";
  if (levelsOn) {
    const points = Math.max(0, Math.floor(num(p.points) ?? 0));
    const nextName = (p.next_name ?? "").trim();
    const nextMin = num(p.next_min_points);
    let fill = 100;
    let nextLine = "Ai cel mai mare nivel";
    let coins = pct ? `<div class="coins" aria-hidden="true"><span class="coin">${escapeHtml(pct)}%</span><span class="track">${escapeHtml(levelName)}</span></div>` : "";
    if (nextName && nextMin !== null && nextMin > 0) {
      fill = Math.max(0, Math.min(100, Math.round((points / nextMin) * 100)));
      const left = Math.max(0, Math.ceil(nextMin - points));
      const np = formatPct(p.next_percent);
      const nextPct = np ? ` (${np}%)` : "";
      nextLine = `Inca ${pointsLabel(left)} pana la ${nextName}${nextPct}`;
      if (pct && np) {
        const nl = levelLook(nextName);
        coins = `<div class="coins" aria-hidden="true"><span class="coin">${escapeHtml(pct)}%</span><span class="track">${escapeHtml(levelName)} &rarr; ${escapeHtml(nextName)}</span><span class="coin next" style="--metal:${nl.metal}">${escapeHtml(np)}%</span></div>`;
      }
    }
    box = `<section class="box" style="${vars}" aria-label="Nivel">
${coins}<p class="pts">${escapeHtml(pointsLabel(points))}</p>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fill}"><span style="width:${fill}%"></span></div>
<p class="next">${escapeHtml(nextLine)}</p>
</section>`;
  }

  const body = `<p class="shop">${escapeHtml(shop)}</p>
<section class="card${look === NEUTRAL ? " neutral" : ""}" style="${vars}" aria-label="Card de client">
<div class="card-top"><p class="lvl">${escapeHtml(label)}</p>${first ? `<p class="who">${escapeHtml(first)}</p>` : ""}</div>
<div class="code">${codeHtml}</div>
<p class="scan">Arata codul la casa</p>
</section>
${box}
<p class="tip">Pastreaza linkul: adauga pagina pe ecranul principal</p>`;

  return page(`Card ${shop}`, look.from, body);
}

// Unknown, revoked or malformed token, or the service is not reachable.
export function renderCardNotFound(): string {
  return page(
    "Card negasit - Tapselo",
    NEUTRAL.from,
    `<section class="nf">
<h1>Nu am gasit cardul</h1>
<p>Linkul nu mai este valabil. Cere la casa magazinului un link nou.</p>
</section>`,
  );
}
