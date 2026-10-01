// Tool registry for /mcp: answer tools (src/lib/mcp/answers) + generator tools (src/lib/generators).

import type { ToolDef } from "./types.ts";
import { createAnswerTools } from "./answers/index.ts";
import { generatorTools } from "../generators/tools.ts";
import rules from "../kb/rules.json" with { type: "json" };
import checklists from "../kb/shop-checklists.json" with { type: "json" };
import competitors from "../kb/competitors.json" with { type: "json" };
import datecs from "../kb/datecs-errors.json" with { type: "json" };
import dibal from "../kb/dibal.json" with { type: "json" };

export const answerTools: ToolDef[] = createAnswerTools({ rules, checklists, competitors, datecs, dibal });

export const allTools: ToolDef[] = [...answerTools, ...generatorTools];
