// /llms.txt (llmstxt.org), built from the site's route data at build time.
import type { APIRoute } from "astro";
import { buildLlmsTxt } from "../lib/llms/llms-txt.ts";

export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
