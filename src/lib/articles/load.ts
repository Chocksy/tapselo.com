import raw from "../kb/articles.json";
import { parseArticlesFile, type SupportArticle } from "./schema.ts";

/** Validated at module load — `npm run build` fails on schema errors. */
export const supportArticles: SupportArticle[] = parseArticlesFile(raw);

export function getArticleBySlug(slug: string): SupportArticle | undefined {
  return supportArticles.find((a) => a.slug === slug);
}
