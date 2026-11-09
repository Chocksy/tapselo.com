// Homepage helpers shared by the home/* sections.
// - data-fit="<px>" (or --fit): zoom a fixed-size device stage down to its parent width (never up).
// - .canvas: kit loops inside pause while the block is offscreen (kit checks `.canvas.off`).

type KitEl = HTMLElement & { ts?: { stop(): void; [k: string]: unknown } };
type TSApi = { rm(): boolean; live(el: Element): boolean; mount(root?: Element | Document): void };
declare global {
  interface Window { TS?: TSApi }
}

/** Run fn once the kit has mounted `el` (kit.js is deferred, our modules may run first). */
export function onKit(el: KitEl | null, fn: () => void) {
  if (!el) return;
  const t = () => (window.TS && el.ts ? fn() : setTimeout(t, 60));
  t();
}

export const reduced = () =>
  window.TS ? window.TS.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True when a block may animate: motion allowed, on screen. */
export const live = (el: Element) => (window.TS ? window.TS.live(el) : !reduced());

function fit(el: HTMLElement) {
  // A media query can swap the stage for another composition by setting --fit on it.
  const native = Number(getComputedStyle(el).getPropertyValue("--fit")) || Number(el.dataset.fit);
  const box = el.parentElement;
  if (!native || !box) return;
  const cs = getComputedStyle(box);
  const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  el.style.zoom = String(Math.min(Number(el.dataset.fitMax ?? 1), w / native));
}

function init() {
  const fits = [...document.querySelectorAll<HTMLElement>("[data-fit]")];
  fits.forEach(fit);
  const ro = new ResizeObserver(() => { fits.forEach(fit); });
  new Set(fits.map((f) => f.parentElement!)).forEach((p) => ro.observe(p));
  ro.observe(document.body);

  const io = new IntersectionObserver(
    (es) => es.forEach((e) => e.target.classList.toggle("off", !e.isIntersecting)),
    { rootMargin: "120px 0px" },
  );
  document.querySelectorAll(".canvas").forEach((c) => io.observe(c));
}

init();
