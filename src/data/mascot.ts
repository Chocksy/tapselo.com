// Site mascot characters (page-mascot sprite sheets in public/mascots/).
// To switch characters, change ACTIVE_MASCOT_ID: it's the only line to edit.

export type MascotCharacter = {
  directions: string;
  reactions: string;
  /** Romanian label for screen readers, matching the drawing (ș/ț with comma below). */
  label: string;
};

export const MASCOTS = {
  /** Custom Tapselo shopkeeper (drawn with gpt-image-1, built to the page-mascot sheet spec). */
  shopkeeper: {
    directions: "/mascots/shopkeeper-directions.webp",
    reactions: "/mascots/shopkeeper-reactions.webp",
    label: "Mascota Tapselo: un vânzător prietenos cu mustață și șorț roșu",
  },
  /** page-mascot's ready-made chef (fallback). */
  chef: {
    directions: "/mascots/chef-directions.webp",
    reactions: "/mascots/chef-reactions.webp",
    label: "Mascota Tapselo: un bucătar prietenos cu mustață",
  },
} satisfies Record<string, MascotCharacter>;

export const ACTIVE_MASCOT_ID: keyof typeof MASCOTS = "shopkeeper";

export const ACTIVE_MASCOT: MascotCharacter = MASCOTS[ACTIVE_MASCOT_ID];

/** localStorage key set by the "Ascunde mascota" button. */
export const MASCOT_HIDDEN_KEY = "tapselo:mascot-hidden";

export const MASCOT_SIZE = 104;
