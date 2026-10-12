export type PricingGratisVariant = "a" | "b" | "c";

export function parsePricingGratisVariant(raw: string | null | undefined): PricingGratisVariant {
  const v = raw?.toLowerCase();
  if (v === "b" || v === "c") return v;
  return "a";
}
