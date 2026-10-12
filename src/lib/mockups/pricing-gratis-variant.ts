export type PricingGratisVariant = "a" | "b" | "c" | "d";

const VARIANTS: PricingGratisVariant[] = ["a", "b", "c", "d"];

export function parsePricingGratisVariant(raw: string | null | undefined): PricingGratisVariant {
  const v = raw?.toLowerCase();
  if (v && VARIANTS.includes(v as PricingGratisVariant)) return v as PricingGratisVariant;
  return "a";
}
