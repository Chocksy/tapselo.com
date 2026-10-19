import type { CardPayload } from "./card-render.ts";

// Local preview data for /card/{token}?mock=1 (functions/card/[token].ts, local hosts only).
export const MOCK_CARD: CardPayload = {
  shop_name: "Magazin Test",
  first_name: "Razvan",
  card_code: "2700000012345",
  levels_on: true,
  level_name: "Argint",
  level_percent: 3,
  points: 1100,
  next_name: "Aur",
  next_min_points: 3000,
  next_percent: 5,
};

/** ?mock=1&variant=off|top|bronz */
export const MOCK_CARD_VARIANTS: Record<string, CardPayload> = {
  off: { ...MOCK_CARD, levels_on: false, level_name: null, level_percent: null, next_name: null, next_min_points: null, next_percent: null },
  top: { ...MOCK_CARD, level_name: "Aur", level_percent: 5, points: 4200, next_name: null, next_min_points: null, next_percent: null },
  bronz: { ...MOCK_CARD, level_name: "Bronz", level_percent: 1, points: 300, next_name: "Argint", next_min_points: 1000, next_percent: 3 },
};
