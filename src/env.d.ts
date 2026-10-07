/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_A4200_PDF_URL?: string;
  /** Barcode -> TVA lookup base URL. Unset/empty: "/api" (same-origin Pages Function); "off" hides the lookup. */
  readonly PUBLIC_BARCODE_API_URL?: string;
  readonly PUBLIC_POSTHOG_KEY?: string;
  readonly PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
