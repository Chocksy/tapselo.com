// Site mascot characters (page-mascot sprite sheets in public/mascots/).
// To switch characters, change ACTIVE_MASCOT_ID: it's the only line to edit.

export type MascotCharacter = {
  directions: string;
  reactions: string;
  /** Same 3x3 sheets at half size, for spots up to 48 px (the reading walker). */
  small: { directions: string; reactions: string };
  /** Romanian label for screen readers, matching the drawing (ș/ț with comma below). */
  label: string;
};

export const MASCOTS = {
  /** Custom Tapselo shopkeeper (drawn with gpt-image-1, built to the page-mascot sheet spec). */
  shopkeeper: {
    directions: "/mascots/shopkeeper-directions.webp",
    reactions: "/mascots/shopkeeper-reactions.webp",
    small: { directions: "/mascots/shopkeeper-directions-sm.webp", reactions: "/mascots/shopkeeper-reactions-sm.webp" },
    label: "Mascota Tapselo: un vânzător prietenos cu mustață și șorț roșu",
  },
  /** page-mascot's ready-made chef (fallback). */
  chef: {
    directions: "/mascots/chef-directions.webp",
    reactions: "/mascots/chef-reactions.webp",
    small: { directions: "/mascots/chef-directions-sm.webp", reactions: "/mascots/chef-reactions-sm.webp" },
    label: "Mascota Tapselo: un bucătar prietenos cu mustață",
  },
} satisfies Record<string, MascotCharacter>;

export const ACTIVE_MASCOT_ID: keyof typeof MASCOTS = "shopkeeper";

export const ACTIVE_MASCOT: MascotCharacter = MASCOTS[ACTIVE_MASCOT_ID];

/** sessionStorage key set by the "Ascunde mascota" button (the old v2 localStorage value under this key is cleared). */
export const MASCOT_HIDDEN_KEY = "tapselo:mascot-hidden";

export const MASCOT_SIZE = 104;

// J2 "Host": Nea Tapselo lives at fixed spots in the page, one reaction each (no cursor follower).
// Cells are [column, row] in the 3x3 sheets, shown with background-size 300% and background-position.
export const REACTIONS = {
  smile: [0, 0], heart: [1, 0], sparkles: [2, 0],
  surprised: [0, 1], star: [1, 1], bliss: [2, 1],
  sleepy: [0, 2], dizzy: [1, 2], laugh: [2, 2],
} as const;
export const LOOKS = { up: [1, 0], left: [0, 1], you: [1, 1], right: [2, 1], down: [1, 2] } as const;
export type Reaction = keyof typeof REACTIONS;
export type Look = keyof typeof LOOKS;
export const cell = ([c, r]: readonly number[]) => `${c * 50}% ${r * 50}%`;

export type MascotOpts = {
  /** Spot name; `ts:mascot` events with this `spot` react here. */
  spot: string;
  /** This spot's reaction, and the one static frame under reduced motion. */
  pose: Reaction;
  /** Frame at rest (default: pose). */
  rest?: Reaction | Look;
  /** Size in px from 768 px up, and on phones. */
  size?: number;
  sizeSm?: number;
  /** Speech bubble shown with the reaction; `sayOn` keeps it on. t: above, l: left, r: right. */
  say?: string;
  sayAt?: "t" | "l" | "r";
  sayOn?: boolean;
  /** Show only the top part (0-1): he peeks over an edge. */
  peek?: number;
  /** Never reacts (hand-off card on guides: the reading bar is his spot there). */
  still?: boolean;
  /** Under reduced motion keep the rest frame instead of the reaction. */
  keep?: boolean;
  /** Extra triggers read by src/scripts/mascot.ts: react once in view, on hover of these elements. */
  view?: boolean;
  hover?: string;
  cls?: string;
};

const attr = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Markup for one mascot spot. Used by Mascot.astro and by client code that renders a spot later.
 *  The reactions sheet is not part of first paint: it sits in `--ri` and the CSS uses it once
 *  src/scripts/mascot.ts has loaded it (html.ms-rx). The directions sheet (rest frames) loads at once. */
export function mascotHtml(o: MascotOpts): string {
  const rest = o.rest ?? o.pose;
  const look = rest in LOOKS;
  const sheet = Math.max(o.size ?? 96, o.sizeSm ?? 80) <= 48 ? ACTIVE_MASCOT.small : ACTIVE_MASCOT;
  const bg = (dir: boolean) => (dir ? `background-image:url(${sheet.directions})` : `--ri:url(${sheet.reactions})`);
  const css = `--s:${o.size ?? 96}px;--sm:${o.sizeSm ?? 80}px${o.peek ? `;--pk:${o.peek}` : ""}`;
  const flags = [o.still && " data-still", o.keep && " data-keep", o.view && " data-view", o.hover && ` data-hover="${attr(o.hover)}"`].filter(Boolean).join("");
  const cls = ["ms", o.peek && "ms-pk", o.cls].filter(Boolean).join(" ");
  const restAt = cell(look ? LOOKS[rest as Look] : REACTIONS[rest as Reaction]);
  const bubble = o.say ? `<span class="ms-b ms-b-${o.sayAt ?? "t"}${o.sayOn ? " ms-b-on" : ""}">${attr(o.say)}</span>` : "";
  return `<span class="${cls}" data-spot="${attr(o.spot)}"${flags} style="${css}" aria-hidden="true"><span class="ms-f"><i class="ms-d"${look ? "" : " data-r"} style="${bg(look)};background-position:${restAt}"></i><i class="ms-r" style="${bg(false)};--p:${cell(REACTIONS[o.pose])}"></i></span>${bubble}</span>`;
}
