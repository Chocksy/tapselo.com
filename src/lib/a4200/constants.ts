export const A4200_NS = "mfp:anaf:dgti:a4200:declaratie:v1";
export const A4203_NS = "mfp:anaf:dgti:a4203:declaratie:v1";

export const XSD_BUNDLE = {
  a4200: {
    file: "a4200_20180910.xsd",
    version: "1.02",
    url: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/a4200_20180910.xsd",
  },
  a4203: {
    file: "a4203_20180927.xsd",
    version: "1.02",
    url: "https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/a4203_20180927.xsd",
  },
} as const;

/** ANAF validator kit versions referenced on the 4200 page (Aug 2026). */
export const ANAF_VALIDATOR_VERSIONS = {
  a4200Jar: "J1.0.5",
  a4203Jar: "06.08.2026",
} as const;

export const VERIFIED_ON = "2026-10-07";

/** tip_amef values supported in v1 (A4203 general-use AMEF). */
export const SUPPORTED_TIP_AMEF = new Set(["U", "A"]);

export const RO_MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

export const NUI_LEN = 10;
export const Z_SUFFIX_LEN = 4;
export const IDM_DAY_LEN = 28;
export const IDM_OPIS_LEN = 24;
