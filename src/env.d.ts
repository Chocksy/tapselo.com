/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_A4200_PDF_URL?: string;
  /** Base URL for tapselo-pos public barcode API, e.g. https://app.tapselo.com/api/public/v1 */
  readonly PUBLIC_BARCODE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
