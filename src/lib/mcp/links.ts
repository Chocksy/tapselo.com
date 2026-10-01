// Every link a tool or generated page gives out carries the same UTM tags.
export const SITE = "https://tapselo.com";

export function trackedUrl(path: string, campaign: string, medium = "mcp"): string {
  const u = new URL(path, SITE);
  u.searchParams.set("utm_source", "ai-plugin");
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}
