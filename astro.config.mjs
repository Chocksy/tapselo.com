// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://tapselo.com',
  output: 'static',
  integrations: [
    sitemap({
      // Shopper pages (store sign-up, store privacy, confirm, unsubscribe) are noindex.
      filter: (page) => !/^\/(c|p|g|o|confirmare|dezabonare)\//.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
