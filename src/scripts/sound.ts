// Site sounds (K1): off by default, one "Sunete" toggle in the footer, saved in localStorage.
// cuelume 0.2.8 is bundled by Vite and only fetched once sound is on. Cues play only after a
// user gesture; every call site is a no-op while sound is off.
type Cue = typeof import("cuelume");
type Opts = Parameters<Cue["play"]>[1];

const KEY = "tapselo.sound";
let cm: Cue | null = null;
let on = false;

const saved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null")?.on === true;
  } catch {
    return false;
  }
};
const save = (v: boolean) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on: v }));
  } catch {}
};

async function load() {
  cm ||= await Promise.race([
    import("cuelume"),
    new Promise<never>((_, no) => setTimeout(() => no(0), 8000)),
  ]);
  cm.setVolume(0.5);
  cm.setEnabled(true);
  return cm;
}

export function sfx(name: Parameters<Cue["play"]>[0], o?: Opts) {
  if (!on || !cm) return;
  try {
    cm.play(name, o);
  } catch {}
}

function paint(btns: HTMLElement[]) {
  btns.forEach((b) => b.setAttribute("aria-pressed", String(on)));
}

export function initSound() {
  const btns = [...document.querySelectorAll<HTMLButtonElement>("[data-sound-toggle]")];
  btns.forEach((b) => (b.hidden = false));
  on = saved();
  paint(btns);
  if (on) {
    // Saved as on: load quietly, then unlock audio on the first real gesture.
    load().catch(() => {});
    const first = () => {
      removeEventListener("pointerdown", first, true);
      removeEventListener("keydown", first, true);
      cm?.unlock();
    };
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);
  }
  // Start the download on intent, so unlock() still runs inside the click on slow networks.
  const pre = () => void load().catch(() => {});
  btns.forEach((b) => ["pointerenter", "pointerdown", "focus"].forEach((ev) => b.addEventListener(ev, pre, { once: true })));
  btns.forEach((b) =>
    b.addEventListener("click", async () => {
      if (on) {
        on = false;
        cm?.setEnabled(false);
      } else {
        try {
          const c = await load();
          if (!(await c.unlock())) throw 0;
          on = true;
          c.play("toggle");
        } catch {
          on = false;
        }
      }
      save(on);
      paint(btns);
    }),
  );
}
