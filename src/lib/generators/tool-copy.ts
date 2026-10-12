import { PUBLIC_PAGE_NOTICE } from "./page.ts";

/** English MCP tool description: public-notice sentence first. */
export function publicGeneratorDescription(body: string): string {
  return `${PUBLIC_PAGE_NOTICE} ${body.trim()}`;
}

export const FLYER_IMAGE_SOURCE =
  "Flyer product visuals are Unicode emoji only: src/lib/generators/flyer.ts (emojiFor) -> flyerToOffers (image_url: null). " +
  "No Open Food Facts, no barcode/product database photos, and no generative model images on MCP flyers " +
  "(picture queue disabled in Chocksy/pos supabase/migrations/20261001150000_public_tool_drafts_no_pictures.sql).";
