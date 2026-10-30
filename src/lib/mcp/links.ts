// Every link a tool or generated page gives out carries the same UTM tags.
export const SITE = "https://tapselo.com";

/** Published Tapselo app in the ChatGPT plugin directory (MCP connector). */
export const CHATGPT_APP_URL =
  "https://chatgpt.com/plugins/plugin_asdk_app_6abe467813cc819183cb64218c65340d";

export function trackedUrl(path: string, campaign: string, medium = "mcp"): string {
  const u = new URL(path, SITE);
  u.searchParams.set("utm_source", "ai-plugin");
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}
