// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { articleLastmodByPath, parseArticlesFile } from './src/lib/articles/schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesRaw = JSON.parse(readFileSync(join(__dirname, 'src/lib/kb/articles.json'), 'utf8'));
const articleLastmod = articleLastmodByPath(parseArticlesFile(articlesRaw));

// https://astro.build/config
export default defineConfig({
  site: 'https://tapselo.com',
  output: 'static',
  integrations: [
    sitemap({
      // Shopper pages (store sign-up, store privacy, confirm, unsubscribe) are noindex.
      filter: (page) => !/^\/(c|p|g|o|confirmare|dezabonare)\//.test(new URL(page).pathname),
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const lastmod = articleLastmod.get(path);
        if (lastmod) {
          return { ...item, lastmod: new Date(lastmod) };
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['xmllint-wasm'],
    },
    assetsInclude: ['**/*.wasm'],
  }
});
