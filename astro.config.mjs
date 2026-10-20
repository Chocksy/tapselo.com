// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { articleLastmodByPath, parseArticlesFile } from './src/lib/articles/schema.ts';
import { anafCuiDevProxyPlugin } from './src/lib/cui-anaf/vite-dev-proxy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesRaw = JSON.parse(readFileSync(join(__dirname, 'src/lib/kb/articles.json'), 'utf8'));
const articleLastmod = articleLastmodByPath(parseArticlesFile(articlesRaw));

// https://astro.build/config
export default defineConfig({
  site: 'https://tapselo.com',
  output: 'static',
  integrations: [
    // compat aliases react/react-dom to preact/compat so page-mascot runs unchanged.
    preact({ compat: true }),
    sitemap({
      // Shopper pages (store sign-up, store privacy, confirm, unsubscribe) are noindex.
      filter: (page) => !/^\/(c|p|g|o|r|confirmare|dezabonare)\//.test(new URL(page).pathname),
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
    plugins: [
      tailwindcss(),
      anafCuiDevProxyPlugin(),
      // Bundle page-mascot in every server environment (ssr + Astro's prerender env, which
      // ignores `vite.ssr`) so the preact/compat alias for `react` applies there too.
      // CI installs with --legacy-peer-deps, so page-mascot's react peer is never installed.
      {
        name: 'page-mascot-no-external',
        configEnvironment(name) {
          if (name !== 'client') return { resolve: { noExternal: ['page-mascot'] } };
        },
      },
    ],
    optimizeDeps: {
      exclude: ['xmllint-wasm'],
    },

    assetsInclude: ['**/*.wasm'],
  }
});
