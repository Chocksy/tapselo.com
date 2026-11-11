// K1 small moments, one engine for the whole site. Loaded once from Footer.astro.
// Hooks are data-moment attributes: scan, total (hero receipt), drawer, copy, result, tear, 404.
// Motion: transform and opacity only. Reduced motion: every moment shows its end state at once.
import "../styles/moments.css";
import { initSound, sfx } from "./sound.ts";

type El = HTMLElement;
const $ = <T extends Element = El>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = El>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const rmq = matchMedia("(prefers-reduced-motion: reduce)");
const rm = () => rmq.matches;
const restart = (el: Element, c: string) => {
  el.classList.remove(c);
  void (el as El).offsetWidth;
  el.classList.add(c);
};
const later = (ms: number, f: () => void) => setTimeout(f, ms);

// Last real gesture: sounds and tool moments run only right after one.
let gestureAt = 0;
for (const ev of ["pointerdown", "keydown", "input"]) addEventListener(ev, (e) => e.isTrusted && (gestureAt = Date.now()), true);
const byUser = (ms = 3000) => Date.now() - gestureAt < ms;

const CHECK = '<path pathLength="1" d="M4 12.5l5 5L20 6.5"/>';
const svg = (inner: string, size: number, cls = "", sw = 2.4, box = 24) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/* 01 scan beep on the hero demo CTA */
function scan() {
  const a = $<HTMLAnchorElement>('a[data-moment="scan"]');
  if (!a) return;
  a.classList.add("mo-scan");
  if (!$(".mo-bc", a)) a.insertAdjacentHTML("afterbegin", '<span class="mo-bc" aria-hidden="true"></span>');
  a.insertAdjacentHTML("beforeend", '<i class="mo-las" aria-hidden="true"></i><i class="mo-wash" aria-hidden="true"></i>');
  const code = "5941234 000826";
  const rd = document.createElement("span");
  rd.className = "mo-rd";
  rd.setAttribute("aria-hidden", "true");
  rd.innerHTML = `${svg(CHECK, 16, "", 2.6)}Cod citit <b>${[...code].map((c, i) => (c === " " ? " " : `<i style="--k:${i}">${c}</i>`)).join("")}</b>`;
  const box = a.parentElement!;
  if (getComputedStyle(box).position === "static") box.style.position = "relative";
  box.append(rd);
  // The beep starts on pointerdown; the click itself navigates at once (any modifier click opens a tab as usual).
  const play = () => {
    sfx("select");
    if (rm()) return void rd.classList.add("mo-on");
    a.style.setProperty("--mo-w", a.offsetWidth + "px");
    restart(a, "mo-go");
    rd.classList.remove("mo-on");
    later(360, () => restart(rd, "mo-on"));
  };
  let downAt = 0;
  a.addEventListener("pointerdown", (e) => !e.button && ((downAt = Date.now()), play()));
  // Keyboard (Enter) has no pointerdown.
  a.addEventListener("click", () => Date.now() - downAt > 1000 && play());
  addEventListener("pageshow", (e) => e.persisted && (a.classList.remove("mo-go"), rd.classList.remove("mo-on")));
}

/* 02 total count-up + 03 receipt print on the hero demo */
function countUp(b: El, delay: number, sound: boolean) {
  const txt = b.textContent || "";
  const end = parseFloat(txt);
  if (rm() || !isFinite(end)) return;
  const tok = {};
  (b as El & { _t?: object })._t = tok;
  b.classList.add("mo-cnt");
  b.textContent = (0).toFixed(2);
  later(delay, () => {
    if (sound) sfx("count", { duration: 900 });
    const t0 = performance.now();
    const f = (now: number) => {
      if ((b as El & { _t?: object })._t !== tok) return;
      const k = Math.min(1, (now - t0) / 900);
      b.textContent = (end * (1 - (1 - k) ** 4)).toFixed(2);
      if (k < 1) requestAnimationFrame(f);
      else (b.textContent = txt), b.classList.remove("mo-cnt");
    };
    requestAnimationFrame(f);
  });
}

// 03: the paper slides out of the slot bottom first, so each line gets its text
// just after it passes the print head (1.2 s print, see moments.css).
function inkLines(paper: El) {
  const top = paper.getBoundingClientRect().top;
  const h = paper.offsetHeight || 1;
  for (const c of paper.children as HTMLCollectionOf<El>)
    c.style.setProperty("--d", Math.round(1200 * (1 - (c.getBoundingClientRect().top - top) / h) + 60) + "ms");
}
function heroReceipt() {
  const stage = $("[data-hero-demo]");
  const paper = stage && $(".rc", stage);
  if (!stage || !paper) return;
  let seen = false;
  let mineAt = 0;
  stage.addEventListener("pointerdown", (e) => e.isTrusted && (mineAt = Date.now()), true);
  new MutationObserver(() => {
    inkLines(paper);
    const b = $('[data-moment="total"]', paper);
    const printing = paper.classList.contains("go");
    const mine = Date.now() - mineAt < 4000;
    if (printing && mine) later(1250, () => sfx("success"));
    if (b && seen) countUp(b, printing ? 620 : 0, mine);
  }).observe(paper, { childList: true });
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    seen = true;
    const b = $('[data-moment="total"]', paper);
    if (b) countUp(b, 250, false);
  }, { threshold: 0.6 });
  io.observe(paper);
}

/* 03 receipt print on the contact form success */
const BON = ["TAPSELO", "BON NEFISCAL", "-", "MESAJ PRIMIT", "Raspuns in 24 de ore", "contact@tapselo.com", "-", "Multumim!"];
function contactPrint() {
  const st = $("#form-status");
  if (!st) return;
  let prn: El | null = null;
  new MutationObserver(() => {
    const ok = st.className.includes("green");
    if (!ok) return void (prn?.remove(), (prn = null));
    if (prn) return;
    prn = document.createElement("div");
    prn.className = "mo-prn";
    prn.setAttribute("aria-hidden", "true");
    prn.innerHTML =
      '<div class="mo-slot"><s>DATECS FP-700</s></div><div class="mo-clip"><div class="mo-pap">' +
      BON.map((t, i) => (t === "-" ? "<hr>" : `<p${i < 2 || i > 6 ? ' class="c"' : ""}>${t}</p>`)).join("") +
      "</div></div>";
    st.after(prn);
    if (!rm()) inkLines($(".mo-pap", prn)!), restart($(".mo-pap", prn)!, "go");
    later(rm() ? 0 : 1250, () => sfx("success"));
  }).observe(st, { attributes: true, attributeFilter: ["class"] });
}

/* 04 register key + cash drawer on the pricing CTA */
function drawer() {
  for (const a of $$<HTMLAnchorElement>('a[data-moment="drawer"]')) {
    const key = a.closest<El>(".mo-key");
    if (!key) continue;
    let down = false;
    let opened = 0;
    const up = (open: boolean) => {
      if (!down) return;
      down = false;
      a.classList.remove("mo-dn");
      if (!open) return;
      opened = Date.now();
      sfx("open");
      rm() ? key.classList.add("mo-open") : restart(key, "mo-open");
      // Close again for modified clicks (new tab), where this page stays.
      later(2400, () => Date.now() - opened >= 2400 && key.classList.remove("mo-open"));
    };
    a.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      const r = a.getBoundingClientRect();
      a.style.setProperty("--x", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(2));
      a.style.setProperty("--y", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(2));
      down = true;
      a.classList.add("mo-dn");
      sfx("tap", { theme: "mech" });
    });
    a.addEventListener("pointerup", () => up(true));
    a.addEventListener("pointerleave", () => up(false));
    a.addEventListener("pointercancel", () => up(false));
    // The click navigates at once; the drawer already opened on pointerup.
    a.addEventListener("click", () => {
      if (Date.now() - opened > 1000) {
        // Keyboard (Enter): press and release the key in one go.
        a.style.setProperty("--x", "0.3");
        a.style.setProperty("--y", "0.2");
        down = true;
        a.classList.add("mo-dn");
        sfx("tap", { theme: "mech" });
        later(rm() ? 0 : 120, () => up(true));
      }
    });
    addEventListener("pageshow", (e) => e.persisted && key.classList.remove("mo-open"));
  }
}

/* 05 copy with a drawn check; the mascot reacts with a heart */
async function writeClip(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}
const COPY_IC = '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>';
function copyBtn(b: El, text: () => string) {
  const label = b.textContent?.trim() || "Copiază";
  b.classList.add("mo-copy");
  b.innerHTML = `<span class="mo-ic">${svg(COPY_IC, 15, "", 2)}${svg(CHECK, 15, "mo-ck", 2.6)}</span><span class="mo-lt"><span>${label}</span><span>Copiat</span></span>`;
  let t = 0;
  b.addEventListener("click", async () => {
    if (!(await writeClip(text()))) return;
    clearTimeout(t);
    b.classList.add("mo-on");
    if (!rm()) restart(b, "mo-go");
    sfx("success");
    document.dispatchEvent(new CustomEvent("ts:mascot", { detail: { pose: "heart" } }));
    t = later(2000, () => b.classList.remove("mo-on", "mo-go"));
  });
}
function copies() {
  for (const b of $$('[data-moment="copy"]')) {
    copyBtn(b, () => {
      const src = b.dataset.copyFrom ? $(b.dataset.copyFrom) : null;
      return b.dataset.copy || (src?.innerText || "").trim();
    });
  }
}

/* 08 calculator result: digits roll, row flashes green, the check circle draws itself */
function roll(next: string, prev: string) {
  const off = prev.length - next.length;
  let k = 0;
  return [...next]
    .map((c, i) => {
      const h = c.replace(/[&<>]/g, (x) => `&#${x.charCodeAt(0)};`);
      return c === " " || prev[i + off] === c ? h : `<i class="mo-r" style="--k:${k++}">${h}</i>`;
    })
    .join("");
}
function results() {
  for (const dl of $$('[data-moment="result"]')) {
    const wrap = document.createElement("div");
    wrap.className = "mo-res";
    dl.before(wrap);
    wrap.append(dl);
    wrap.insertAdjacentHTML("beforeend", svg('<circle pathLength="1" cx="20" cy="20" r="17"/><path pathLength="1" d="M12.5 20.5l5 5 10-11"/>', 34, "mo-rck", 2.4, 40));
    const cp = document.createElement("button");
    cp.type = "button";
    cp.textContent = "Copiază rezultatul";
    cp.hidden = true;
    wrap.append(cp);
    copyBtn(cp, () => {
      const dt = $("dt", dl), dd = $("dd", dl);
      return dt && dd ? `${dt.textContent?.trim()}: ${dd.textContent?.trim()}` : "";
    });
    let last = "";
    let t = 0;
    const run = () => {
      const dd = $("dd", dl);
      cp.hidden = !dd;
      if (!dd) return void ((last = ""), wrap.classList.remove("mo-ok"));
      const v = dd.textContent || "";
      if (v === last) return;
      const prev = last;
      last = v;
      if (!byUser()) return void wrap.classList.add("mo-ok");
      sfx("ready");
      wrap.classList.add("mo-ok");
      if (rm()) return;
      dd.innerHTML = roll(v, prev);
      mo.takeRecords();
      restart(wrap, "mo-go");
    };
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = later(360, run);
    });
    mo.observe(dl, { childList: true, subtree: true, characterData: true });
  }
}

/* 06 tear edge: the section rises once, its h2 goes from soft to sharp word by word */
function words(h: El) {
  const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode as Text);
  let i = 0;
  for (const n of nodes) {
    const parts = (n.nodeValue || "").split(/(\s+)/);
    if (!parts.some((p) => p.trim())) continue;
    const f = document.createDocumentFragment();
    for (const p of parts) {
      if (!p) continue;
      if (!p.trim()) f.append(p);
      else {
        const s = document.createElement("span");
        s.className = "mo-w";
        s.style.setProperty("--i", String(i++));
        s.textContent = p;
        f.append(s);
      }
    }
    n.replaceWith(f);
  }
  h.style.setProperty("--st", Math.min(55, 1000 / Math.max(1, i - 1)) + "ms");
}
// After the moment, put the heading text back as plain text, so no page CSS can ever match the word spans.
function unwords(s: El) {
  for (const w of $$(".mo-w", s)) w.replaceWith(w.textContent || "");
  for (const h of $$("h2", s)) h.style.removeProperty("--st"), h.normalize();
}
function tears() {
  const secs = $$('[data-moment="tear"]');
  if (!secs.length || rm() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const s = e.target as El;
        io.unobserve(s);
        s.classList.add("mo-in");
        later(1800, () => (s.classList.remove("mo-tear", "mo-in"), unwords(s)));
      }),
    { rootMargin: "0px 0px -15% 0px" },
  );
  for (const s of secs) {
    // Only sections still below the fold rise; the ones already seen stay put.
    if (s.getBoundingClientRect().top < innerHeight * 0.92) continue;
    const h = $("h2", s);
    if (h) words(h);
    s.classList.add("mo-tear");
    io.observe(s);
  }
  // An anchor jump ("Vezi prețurile", the section rail) lands on a finished section: the target and
  // every section above it show at once instead of rising after the jump.
  const show = (s: El) => (io.unobserve(s), s.classList.remove("mo-tear", "mo-in"), unwords(s));
  const jump = (hash: string) => {
    let t: Element | null = null;
    try {
      t = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    } catch {}
    if (!t) return;
    for (const s of secs)
      if (s.classList.contains("mo-tear") && (s.contains(t) || s.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)) show(s);
  };
  document.addEventListener("click", (e) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href*='#']");
    if (a && a.pathname === location.pathname && a.hash) jump(a.hash);
  }, true);
  addEventListener("hashchange", () => jump(location.hash));
  jump(location.hash);
}

/* 10 hold to cancel the bon in the hero demo (wraps the kit's "Anuleaza cosul") */
function hold() {
  const stage = $("[data-hero-demo]");
  const K = stage && $<El & { ts?: { reset(): void } }>(".ts-kiosk", stage);
  if (!stage || !K) return;
  let p = 0, dir = 0, last = 0, raf = 0, busy = false;
  const btn = () => $('[data-a="clr"]', K);
  const mark = () => {
    const b = btn();
    if (!b || b.dataset.mo) return;
    b.dataset.mo = "1";
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    b.setAttribute("aria-label", "Ține apăsat ca să anulezi bonul");
    b.title = "Ține apăsat";
    b.insertAdjacentHTML("beforeend", '<i class="mo-fill" aria-hidden="true"></i>');
  };
  new MutationObserver(mark).observe(K, { childList: true, subtree: true });
  mark();
  const paint = () => {
    const b = btn();
    if (!b) return;
    mark();
    b.classList.toggle("mo-hold", p > 0);
    $(".mo-fill", b)?.style.setProperty("transform", `scaleX(${p})`);
  };
  const loop = (ts: number) => {
    const dt = Math.min(64, ts - (last || ts));
    last = ts;
    p = Math.max(0, Math.min(1, p + (dt / 1800) * dir));
    paint();
    if (p >= 1) return commit();
    if (p <= 0 && dir < 0) return void (dir = 0);
    raf = requestAnimationFrame(loop);
  };
  const run = (d: number) => {
    dir = d;
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    const b = btn();
    if (busy || !b || b.classList.contains("ts-dis")) return false;
    sfx("tap", { theme: "mech" });
    run(1);
    return true;
  };
  const rel = () => dir > 0 && run(-2.5);
  const commit = () => {
    dir = 0;
    busy = true;
    sfx("close");
    const left = $(".ts-left", K);
    const done = () => {
      p = 0;
      busy = false;
      K.ts?.reset();
      const lcd = $(".lcd", stage);
      if (lcd) lcd.textContent = "0.00";
    };
    if (rm() || !left) return done();
    left.classList.add("mo-crumple");
    left.insertAdjacentHTML("beforeend", '<span class="mo-stamp" aria-hidden="true">ANULAT</span>');
    later(900, done);
  };
  K.addEventListener("pointerdown", (e) => {
    if (!(e.target as Element).closest('[data-a="clr"]') || !e.isTrusted) return;
    start();
  }, true);
  addEventListener("pointerup", rel);
  addEventListener("pointercancel", rel);
  // The kit empties the cart on click; holding replaces that.
  K.addEventListener("click", (e) => {
    if (e.isTrusted && (e.target as Element).closest('[data-a="clr"]')) e.stopImmediatePropagation();
  }, true);
  K.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && (e.target as Element).closest('[data-a="clr"]')) {
      e.preventDefault();
      if (!e.repeat) start();
    }
  });
  addEventListener("keyup", (e) => (e.key === " " || e.key === "Enter") && rel());
}

/* 07 menu and 12 404: sound only, on click */
function clickSounds() {
  document.addEventListener("click", (e) => {
    const t = e.target as Element;
    const m = t.closest(".sb-t[data-p], [data-mm-open]");
    if (m && m.getAttribute("aria-expanded") === "true") sfx("open");
    if (t.closest('[data-moment="404"]')) sfx("attention");
  });
}

initSound();
scan();
heroReceipt();
contactPrint();
drawer();
copies();
results();
tears();
hold();
clickSounds();
