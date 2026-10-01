// Builds every answer tool from knowledge base data passed in (tests use inline fixtures).

import type { ToolDef } from "../types.ts";
import { asArray, type KbEntry } from "../text.ts";
import { createSearchRulesTool } from "./rules.ts";
import { createDatecsTool, type DatecsKb } from "./datecs.ts";
import { createDibalHelpTool } from "./dibal.ts";
import { createDecodeScaleBarcodeTool } from "./scale-barcode.ts";
import { createShelfPriceTool } from "./shelf-price.ts";
import { createCheckCompanyTool } from "./company.ts";
import { createThresholdsTool } from "./thresholds.ts";
import { createChecklistTool, type Checklist } from "./checklist.ts";
import { createCompareTool, type Competitor } from "./compare.ts";
import { createProductsTool } from "./products.ts";

export interface AnswerKb {
  rules: unknown;
  checklists: unknown;
  competitors: unknown;
  datecs: unknown;
  dibal: unknown;
}

export const ANSWER_TOOL_NAMES = [
  "search_business_rules",
  "explain_datecs_error",
  "dibal_scale_help",
  "decode_scale_barcode",
  "calculate_shelf_price",
  "check_company",
  "check_tax_thresholds",
  "open_shop_checklist",
  "compare_pos_systems",
  "lookup_products_by_ean",
] as const;

export function createAnswerTools(kb: AnswerKb): ToolDef[] {
  const datecs = (kb.datecs && typeof kb.datecs === "object" ? kb.datecs : {}) as Partial<DatecsKb>;
  return [
    createSearchRulesTool(asArray<KbEntry>(kb.rules)),
    createDatecsTool({ codes: datecs.codes ?? {}, hints: datecs.hints ?? {} }),
    createDibalHelpTool(asArray<KbEntry>(kb.dibal)),
    createDecodeScaleBarcodeTool(),
    createShelfPriceTool(),
    createCheckCompanyTool(),
    createThresholdsTool(),
    createChecklistTool(asArray<Checklist>(kb.checklists)),
    createCompareTool(asArray<Competitor>(kb.competitors)),
    createProductsTool(),
  ];
}
