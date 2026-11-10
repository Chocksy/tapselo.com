// J2 "Host": Nea Tapselo at fixed spots (markup from Mascot.astro / mascotHtml). One reaction per spot,
// the "Ascunde mascota" button (per visit, sessionStorage) and the reading bar walker on guides.
// Other code asks for a reaction with: document.dispatchEvent(new CustomEvent("ts:mascot", { detail: { spot?, pose } })).
// Motion: transform and opacity only. Reduced motion: CSS shows one static frame and nothing here reacts.
import { ACTIVE_MASCOT, MASCOT_HIDDEN_KEY, REACTIONS, cell, type Reaction } from "../data/mascot.ts";

type M = HTMLElement & { _t?: number; _end?: () => void; _p?: number; _sec?: number; _rest?: string };
const R = document.documentElement;
const rm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const off = () => R.classList.contains("ms-off");
const $$ = <T extends Element = M>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const spot = (s: string) => document.querySelector<M>(`.ms[data-spot="${s}"]`);

/* The reactions sheet stays out of first paint (Mascot.astro keeps it in --ri). Fetch it on the first
   reaction, hover, near a spot that rests on it, or 1.5 s after load; ms-rx then shows it. */
let rx: Promise<unknown> | undefined;
const need = () =>
  (rx ??= Promise.all(
    [...new Set([ACTIVE_MASCOT.reactions, ...$$<HTMLElement>(".ms-r").map((e) => e.style.getPropertyValue("--ri").slice(4, -1))])].map((u) =>
      Object.assign(new Image(), { src: u }).decode().catch(() => {}),
    ),
  ).then(() => R.classList.add("ms-rx")));
const lz = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (lz.disconnect(), need()), { rootMargin: "300px" });
for (const m of $$(".ms")) if (m.querySelector(".ms-d[data-r]") || (rm() && !m.hasAttribute("data-keep"))) lz.observe(m);
addEventListener("load", () => setTimeout(need, 1500));
for (const e of $$<HTMLElement>(".ms-f, [data-ms-hide], [data-rn-q]")) for (const t of ["pointerenter", "focusin"]) e.addEventListener(t, need, { once: true });

/** Show `pose` (default: the spot's own reaction) for `ms` milliseconds; 0 keeps it on. */
export function react(m: M | null | undefined, pose?: string, ms = 1600) {
  if (!m || off() || rm()) return;
  if (!R.classList.contains("ms-rx")) return void need().then(() => react(m, pose, ms));
  m.querySelector<HTMLElement>(".ms-r")!.style.backgroundPosition = pose && pose in REACTIONS ? cell(REACTIONS[pose as Reaction]) : "";
  m.classList.add("on");
  clearTimeout(m._t);
  if (ms) m._t = window.setTimeout(() => (m.classList.remove("on"), m._end?.()), ms);
}

function nearest() {
  let best: M | undefined, d = Infinity;
  for (const m of $$(".ms[data-spot]:not([data-still])")) {
    const r = m.getBoundingClientRect();
    if (!r.width) continue;
    const k = Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
    if (k < d) (d = k), (best = m);
  }
  return best;
}
document.addEventListener("ts:mascot", (e) => {
  const d = (e as CustomEvent).detail || {};
  react(d.spot ? spot(d.spot) : nearest(), d.pose);
});

/* hide for this visit; he smiles 400 ms first */
const setOff = (v: boolean) => {
  R.classList.toggle("ms-off", v);
  for (const b of $$("[data-ms-hide] span")) b.textContent = v ? "Arată mascota" : "Ascunde mascota";
  try {
    v ? sessionStorage.setItem(MASCOT_HIDDEN_KEY, "1") : sessionStorage.removeItem(MASCOT_HIDDEN_KEY);
  } catch {}
};
try {
  if (sessionStorage.getItem(MASCOT_HIDDEN_KEY) === "1") setOff(true);
} catch {}
for (const b of $$("[data-ms-hide]")) {
  b.addEventListener("click", () => {
    if (off()) return setOff(false);
    if (rm()) return setOff(true);
    need().then(() => {
      R.classList.add("ms-bye");
      setTimeout(() => (setOff(true), setTimeout(() => R.classList.remove("ms-bye"), 400)), 400);
    });
  });
}

/* generic triggers: once in view, on hover of nearby elements */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => e.isIntersecting && (io.unobserve(e.target), setTimeout(() => react(e.target as M, undefined, 1800), 700))),
  { threshold: 0.6 },
);
for (const m of $$(".ms[data-view]")) io.observe(m);
for (const m of $$(".ms[data-hover]")) {
  const scope = m.closest("section") ?? document;
  for (const h of $$<HTMLElement>(m.dataset.hover!, scope)) h.addEventListener("pointerenter", () => react(m, undefined, 1800));
}

/* hero: heart on every demo sale, once the visitor drives the kiosk */
const hero = spot("hero");
const stage = hero?.closest<HTMLElement>("[data-hero-demo]");
if (hero && stage) {
  let mine = false;
  stage.addEventListener("pointerdown", (e) => e.isTrusted && (e.target as Element).closest(".ts-kiosk") && (mine = true), true);
  stage.addEventListener("ts:sale", () => mine && react(hero, undefined, 1800));
}

/* calculator: sparkles when a new result shows */
const calc = spot("calc");
const card = calc?.closest(".ut-card");
if (calc && card) {
  let t = 0;
  card.addEventListener("input", () => {
    clearTimeout(t);
    t = window.setTimeout(() => card.querySelector(".ut-result dd") && react(calc, undefined, 1200), 380);
  });
}

/* phone page: laugh when the visitor's sale reaches "Gata" */
const ph = spot("phone");
const pd = ph?.closest<HTMLElement>("[data-pd]");
if (ph && pd) {
  let mine = false;
  pd.addEventListener("pointerdown", (e) => e.isTrusted && (mine = true), true);
  new MutationObserver(() => mine && pd.dataset.s === "4" && react(ph, undefined, 1200)).observe(pd, { attributeFilter: ["data-s"] });
}

/* footer: asleep on the line, wakes up while you hover the bottom row */
const ft = spot("footer");
if (ft?.parentElement) {
  let hov = false; // the sheet may still be loading when the pointer leaves
  ft.parentElement.addEventListener("pointerenter", () => ((hov = true), need().then(() => hov && react(ft, undefined, 0))));
  ft.parentElement.addEventListener("pointerleave", () => ((hov = false), ft.classList.remove("on")));
}

/* guides: reading bar under the sub-nav, he walks along it (sleepy, then smiling, star eyes at the end) */
const rd = document.querySelector<HTMLElement>("[data-rd]");
const walker = spot("read");
const text = document.querySelector<HTMLElement>("[data-guide-toc-root]") ?? document.querySelector("main");
if (rd && walker && text) {
  const bar = rd.querySelector<HTMLElement>("i")!;
  const nav = rd.parentElement!;
  let p = -1, x = 0, idle = 0, raf = 0;
  const mood = () => react(walker, p >= 0.98 ? "star" : p < 0.15 ? "sleepy" : "smile", 0);
  walker._end = mood;
  const track = () => {
    const box = nav.querySelector<HTMLElement>(".site-container")!.getBoundingClientRect();
    const q = nav.querySelector<HTMLElement>("[data-rn-sq]")!, qb = nav.querySelector<HTMLElement>("[data-rn-qb]")!;
    const qr = q.getBoundingClientRect(), br = qb.getBoundingClientRect();
    const a = br.width ? br.right + 6 : box.left + parseFloat(getComputedStyle(nav.querySelector(".site-container")!).paddingLeft);
    const b = (qr.width && !nav.classList.contains("q-open") ? qr.left - 12 : box.right - 8) - walker.offsetWidth;
    return [a, Math.max(a, b)];
  };
  const look = (dir: number) => {
    walker.classList.remove("on");
    walker.querySelector<HTMLElement>(".ms-d")!.style.backgroundPosition = dir > 0 ? "100% 50%" : "0 50%";
  };
  const upd = () => {
    raf = 0;
    const r = text.getBoundingClientRect();
    const n = Math.min(1, Math.max(0, Math.round(((140 - r.top) / Math.max(1, r.height - innerHeight + 140)) * 24) / 24));
    bar.style.transform = `scaleX(${n})`;
    const [a, b] = track();
    const still = rm();
    const nx = still ? a : a + (b - a) * n;
    if (n !== p && p >= 0 && !still) look(n - p);
    p = n;
    if (nx !== x) walker.style.transform = `translateX(${(x = nx)}px)`;
    clearTimeout(idle);
    if (!still) idle = window.setTimeout(mood, 600);
  };
  const go = () => raf || (raf = requestAnimationFrame(upd));
  addEventListener("scroll", go, { passive: true });
  addEventListener("resize", go);
  upd();
}

/* page-mascot's moves at every spot: the head follows a fine pointer (8 sectors, a dead zone, hysteresis)
   and goes back to the spot's rest frame after 3 s without movement; a click blinks, then heart, sparkles
   or laugh with a squash, and 4 quick clicks make him dizzy. Not the walker (it looks where it walks),
   not the asleep footer (it wakes on hover) and not still spots. */
const SEC = Math.PI / 4;
const CW = [5, 8, 7, 6, 3, 0, 1, 2]; // directions-sheet cells clockwise from "right", like atan2 with y down
const tap = $$(".ms[data-spot]:not([data-still]):not([data-spot=read])");
const follow = tap.filter((m) => m.dataset.spot !== "footer");
let pt: { x: number; y: number } | null = null, aimRaf = 0, idleT = 0;
const restAll = () =>
  follow.forEach((m) => m._rest !== undefined && ((m.querySelector<HTMLElement>(".ms-d")!.style.cssText = m._rest), (m._sec = undefined)));
const aim = () => {
  aimRaf = 0;
  if (!pt || off() || rm()) return;
  for (const m of follow) {
    const b = m.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > innerHeight) continue;
    const d = m.querySelector<HTMLElement>(".ms-d")!;
    m._rest ??= d.style.cssText;
    // Peek spots are cut at the bottom: aim from the middle of the full square.
    const dx = pt.x - (b.left + b.width / 2), dy = pt.y - (b.top + b.width / 2);
    let i = 4;
    if (Math.hypot(dx, dy) > b.width / 2) {
      const a = Math.atan2(dy, dx), s0 = m._sec ?? -1;
      if (s0 >= 0 && Math.abs(Math.atan2(Math.sin(a - s0 * SEC), Math.cos(a - s0 * SEC))) < SEC / 2 + 0.12) continue;
      m._sec = (Math.round(a / SEC) + 8) % 8;
      i = CW[m._sec];
    } else m._sec = -1;
    d.style.backgroundImage = `url(${ACTIVE_MASCOT.directions})`;
    d.style.backgroundPosition = cell([i % 3, Math.floor(i / 3)]);
  }
  clearTimeout(idleT);
  idleT = window.setTimeout(restAll, 3000);
};
if (follow.length && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const go = () => aimRaf || (aimRaf = requestAnimationFrame(aim));
  addEventListener("pointermove", (e) => ((pt = { x: e.clientX, y: e.clientY }), go()), { passive: true });
  addEventListener("scroll", () => pt && go(), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => (clearTimeout(idleT), restAll()));
}

const SQUASH = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];
const PAY: Reaction[] = ["heart", "sparkles", "laugh"];
let boops = 0, boopAt = 0;
for (const m of tap) {
  const f = m.querySelector<HTMLElement>(".ms-f")!;
  f.addEventListener("click", () => {
    if (off() || rm()) return;
    const now = Date.now();
    boops = now - boopAt < 1600 ? boops + 1 : 1;
    boopAt = now;
    clearTimeout(m._p);
    m.classList.add("bp"); // the spot's speech bubble is for its own moment, not for a poke
    if (boops >= 4) (boops = 0), react(m, "dizzy", 1100);
    else {
      react(m, "smile", 0); // the "smile" cell has his eyes shut: a blink
      m._p = window.setTimeout(() => react(m, PAY[(boops - 1) % 3], 440), 120);
    }
    f.animate(SQUASH, { duration: 420, easing: "linear" });
    setTimeout(() => m.classList.contains("on") || m.classList.remove("bp"), 1600);
  });
}
