import type { CompanyInfo } from "./types.ts";
import { interpretAnafResponseText } from "./anaf-response.ts";

/** Parses ANAF PlatitorTvaRest v9 JSON text. Returns null only when CUI is genuinely not found. */
export function parseAnafResponse(text: string, cui: string): CompanyInfo | null {
  const outcome = interpretAnafResponseText(text, cui);
  if (outcome.kind === "ok") return outcome.company;
  if (outcome.kind === "not_found") return null;
  throw new Error("ANAF response unavailable");
}
