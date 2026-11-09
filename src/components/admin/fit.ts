// Zoom-to-fit for fixed-size stages (device screens drawn at native px).
// <div data-fit="900"> gets zoom = parent width / 900, capped by data-fit-max (default 1).
// zoom (not transform) so the layout box shrinks with it and the page keeps its height.
function fit(el: HTMLElement) {
  const native = Number(el.dataset.fit);
  const box = el.parentElement;
  if (!native || !box) return;
  const max = Number(el.dataset.fitMax ?? 1);
  const w = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
  el.style.zoom = String(Math.min(max, w / native));
}

const els = [...document.querySelectorAll<HTMLElement>("[data-fit]")];
const ro = new ResizeObserver((entries) => {
  for (const e of entries) for (const el of els) if (el.parentElement === e.target) fit(el);
});
for (const el of els) {
  fit(el);
  if (el.parentElement) ro.observe(el.parentElement);
}
