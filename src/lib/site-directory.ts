// Navigation index for /ghid and /unelte pages (footer, homepage resources).
import rules from "./kb/rules.json";
import checklists from "./kb/shop-checklists.json";
import { supportArticles } from "./articles/load.ts";
import { articlePath, A4200_CHECKER_PATH } from "./articles/schema.ts";
import { internalPath } from "./internal-url.ts";
import { datecsErrorPages, datecsPagePath } from "./datecs-pages/pages.ts";

export type SiteLink = { href: string; label: string };

export const toolLinks: SiteLink[] = [
  { href: internalPath("/unelte/calculator-tva"), label: "Calculator TVA" },
  { href: internalPath("/unelte/verificare-cod-de-bare"), label: "Verificare cod de bare" },
  { href: internalPath("/unelte/verificare-cui"), label: "Verificare CUI ANAF" },
  { href: internalPath("/unelte/registru-de-casa"), label: "Registru de casă" },
  { href: internalPath("/unelte/dispozitie-de-plata"), label: "Dispoziție de plată" },
  { href: internalPath("/unelte/generator-nir"), label: "Generator NIR" },
  { href: internalPath("/unelte/generator-aviz-de-insotire"), label: "Aviz de însoțire a mărfii" },
  { href: internalPath("/unelte/fisa-de-magazie"), label: "Fișă de magazie" },
  { href: internalPath("/unelte/generator-borderou-de-achizitie"), label: "Borderou de achiziție" },
  { href: internalPath("/unelte/calculator-adaos-comercial"), label: "Calculator adaos comercial" },
  { href: internalPath("/unelte/calculator-reducere"), label: "Calculator reducere" },
  { href: internalPath("/unelte/generator-cod-de-bare"), label: "Generator cod de bare" },
  { href: internalPath("/unelte/afise-obligatorii-magazin"), label: "Afișe obligatorii magazin" },
  { href: internalPath(A4200_CHECKER_PATH), label: "Verificare A4200" },
];

export const guideHubLinks: SiteLink[] = [
  { href: internalPath("/ghid"), label: "Index ghid" },
  { href: internalPath("/ghid/erori-datecs"), label: "Erori casă de marcat Datecs" },
  { href: internalPath("/ghid/cantar-dibal"), label: "Cântar Dibal" },
  { href: internalPath("/ghid/articole"), label: "Articole de suport" },
  { href: internalPath("/comparatie"), label: "Comparație POS" },
  { href: internalPath("/comparatie/cel-mai-bun-program-casa-de-marcat"), label: "Cel mai bun program de casă de marcat" },
];

export const ruleGuideLinks: SiteLink[] = [
  ...rules.map((r) => ({
    href: internalPath(r.page),
    label: r.title,
  })),
  { href: internalPath("/ghid/registru-unic-de-control"), label: "Registrul unic de control (RUC)" },
];

export const shopGuideLinks: SiteLink[] = checklists.map((c) => ({
  href: internalPath(c.page),
  label: c.title,
}));

export const articleLinks: SiteLink[] = supportArticles.map((a) => ({
  href: internalPath(articlePath(a.slug)),
  label: a.title,
}));

/** Per-error Datecs pages under /ghid/erori-datecs/<slug>/ (TAP-018). */
export const datecsErrorPageLinks: SiteLink[] = datecsErrorPages.map((p) => ({
  href: datecsPagePath(p.slug),
  label: `${p.message} la casa de marcat Datecs (${p.code})`,
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
  for (const d of datecsErrorPageLinks) paths.add(d.href);
  paths.add(internalPath("/ghid/cantar-dibal"));
  paths.add(internalPath("/ghid/registru-unic-de-control"));
  paths.add(internalPath("/ghid/articole"));
  return [...paths].sort();
}
