# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## Meta Pixel + Conversions API (/demo/ only)

The Meta Pixel loads **only on `/demo/`**, and only after the visitor clicks "Accept" in the consent box shown there. No other page ships any Meta code; `tests/meta-pixel-scope.test.ts` builds the site with a pixel ID and checks that.

| Variable | Where | What |
| --- | --- | --- |
| `PUBLIC_META_PIXEL_ID` | build time: GitHub Actions variable (used by `deploy.yml`) | Numeric pixel ID. Unset: no banner, no pixel, no events. |
| `META_CAPI_TOKEN` | Cloudflare Pages → Settings → Environment variables, Production, **encrypted** | Conversions API token. Unset: `/api/meta-capi` answers 204 and sends nothing. |
| `META_PIXEL_ID` | Cloudflare Pages env | Same value as `PUBLIC_META_PIXEL_ID`. |
| `META_GRAPH_VERSION`, `META_TEST_EVENT_CODE` | Cloudflare Pages env, optional | Graph API version (default `v24.0`); Events Manager test code. |

On a demo CTA click, `/demo/` sends `demo_started` to the pixel, to `/api/meta-capi` (`functions/api/meta-capi.ts`, forwarded to the Graph API) and to PostHog, all with the same `event_id`. It also adds `utm_*`, `fbclid`, `fbc`, `fbp`, `event_id` and `landing_page` to the demo link and to the `tapselo_attr` cookie on `.tapselo.com`. Only allowlisted fields leave the browser or the function (`src/lib/meta/`). No email, phone, CUI, price or barcode is ever sent.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
