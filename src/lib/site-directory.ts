// Navigation index for /ghid and /unelte pages (footer, homepage resources).
import rules from "./kb/rules.json";
import checklists from "./kb/shop-checklists.json";
import { supportArticles } from "./articles/load.ts";
import { articlePath, A4200_CHECKER_PATH } from "./articles/schema.ts";
import { internalPath } from "./internal-url.ts";

export type SiteLink = { href: string; label: string };

export const toolLinks: SiteLink[] = [
  { href: internalPath("/unelte/calculator-tva"), label: "Calculator TVA" },
  { href: internalPath("/unelte/verificare-cod-de-bare"), label: "Verificare cod de bare" },
  { href: internalPath("/unelte/registru-de-casa"), label: "Registru de casă" },
  { href: internalPath("/unelte/generator-nir"), label: "Generator NIR" },
  { href: internalPath("/unelte/calculator-adaos-comercial"), label: "Calculator adaos comercial" },
  { href: internalPath("/unelte/generator-cod-de-bare"), label: "Generator cod de bare" },
  { href: internalPath(A4200_CHECKER_PATH), label: "Verificare A4200" },
];

export const guideHubLinks: SiteLink[] = [
  { href: internalPath("/ghid"), label: "Index ghid" },
  { href: internalPath("/ghid/erori-datecs"), label: "Erori casă de marcat Datecs" },
  { href: internalPath("/ghid/cantar-dibal"), label: "Cântar Dibal" },
  { href: internalPath("/ghid/articole"), label: "Articole de suport" },
  { href: internalPath("/comparatie"), label: "Comparație POS" },
];

export const ruleGuideLinks: SiteLink[] = rules.map((r) => ({
  href: internalPath(r.page),
  label: r.title,
}));

export const shopGuideLinks: SiteLink[] = checklists.map((c) => ({
  href: internalPath(c.page),
  label: c.title,
}));

export const articleLinks: SiteLink[] = supportArticles.map((a) => ({
  href: internalPath(articlePath(a.slug)),
  label: a.title,
}));

/** Every /ghid/* and /unelte/* URL we ship (for crawl tests). */
export function allGhidUneltePaths(): string[] {
  const paths = new Set<string>();
  paths.add(internalPath("/ghid"));
  paths.add(internalPath("/unelte"));
  for (const t of toolLinks) paths.add(t.href);
  for (const g of ruleGuideLinks) paths.add(g.href);
  for (const g of shopGuideLinks) paths.add(g.href);
  for (const a of articleLinks) paths.add(a.href);
  paths.add(internalPath(A4200_CHECKER_PATH));
  paths.add(internalPath("/ghid/erori-datecs"));
  paths.add(internalPath("/ghid/cantar-dibal"));
  paths.add(internalPath("/ghid/articole"));
  return [...paths].sort();
}
