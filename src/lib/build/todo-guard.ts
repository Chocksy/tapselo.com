// Build-time guard: fail `astro build` while any content placeholder (TODO-* slot or
// {DATA_*} date) is left in the generated HTML, so a draft page can't ship by accident.
// Local preview of a draft: ALLOW_TODO_PLACEHOLDERS=1 npm run build.
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

export const TODO_PATTERN = /data-todo="[^"]*"|\bTODO-[A-Z][A-Z0-9_-]*|\{DATA_[A-Z_]+/g;

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** Pages (dist-relative paths) that still contain placeholders, with their distinct matches. */
export async function findTodoPlaceholders(distDir: string): Promise<{ page: string; matches: string[] }[]> {
  const hits: { page: string; matches: string[] }[] = [];
  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, "utf8");
    const matches = [...new Set(html.match(TODO_PATTERN) ?? [])];
    if (matches.length) hits.push({ page: relative(distDir, file), matches });
  }
  return hits;
}

export function todoGuard(): AstroIntegration {
  return {
    name: "tapselo-todo-guard",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const hits = await findTodoPlaceholders(fileURLToPath(dir));
        if (hits.length === 0) return;
        const list = hits.map((h) => `  ${h.page}: ${h.matches.join(", ")}`).join("\n");
        if (process.env.ALLOW_TODO_PLACEHOLDERS === "1") {
          logger.warn(`TODO placeholders left (allowed by ALLOW_TODO_PLACEHOLDERS=1):\n${list}`);
          return;
        }
        throw new Error(
          `Build stopped: content placeholders are still in the HTML. Fill them before publishing:\n${list}`,
        );
      },
    },
  };
}
