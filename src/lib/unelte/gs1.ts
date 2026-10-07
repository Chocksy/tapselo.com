// GS1 company prefix -> issuing GS1 member organization, and EAN-13 check digit analysis.
// The prefix says which national GS1 office allocated the code, not where the product was made.
// Ranges from the GS1 Company Prefix list (gs1.org/standards/id-keys/company-prefix). Pure, no DOM.

import { eanCheckDigit } from "../ean13.ts";

export type PrefixKind = "country" | "restricted" | "coupon" | "book" | "serial" | "special" | "unassigned";

export interface PrefixInfo {
  /** The three digits that were looked up. */
  prefix: string;
  /** Romanian label, e.g. "România" or "Cod intern de magazin". */
  label: string;
  kind: PrefixKind;
}

type Range = [from: number, to: number, label: string, kind?: PrefixKind];

const RANGES: Range[] = [
  [0, 19, "SUA și Canada"],
  [20, 29, "Cod intern (circulație restrânsă)", "restricted"],
  [30, 39, "SUA"],
  [40, 49, "Cod intern (circulație restrânsă)", "restricted"],
  [50, 59, "Cupoane", "coupon"],
  [60, 139, "SUA și Canada"],
  [200, 299, "Cod intern de magazin", "restricted"],
  [300, 379, "Franța și Monaco"],
  [380, 380, "Bulgaria"],
  [383, 383, "Slovenia"],
  [385, 385, "Croația"],
  [387, 387, "Bosnia și Herțegovina"],
  [389, 389, "Muntenegru"],
  [390, 390, "Kosovo"],
  [400, 440, "Germania"],
  [450, 459, "Japonia"],
  [460, 469, "Rusia"],
  [470, 470, "Kârgâzstan"],
  [471, 471, "Taiwan"],
  [474, 474, "Estonia"],
  [475, 475, "Letonia"],
  [476, 476, "Azerbaidjan"],
  [477, 477, "Lituania"],
  [478, 478, "Uzbekistan"],
  [479, 479, "Sri Lanka"],
  [480, 480, "Filipine"],
  [481, 481, "Belarus"],
  [482, 482, "Ucraina"],
  [483, 483, "Turkmenistan"],
  [484, 484, "Republica Moldova"],
  [485, 485, "Armenia"],
  [486, 486, "Georgia"],
  [487, 487, "Kazahstan"],
  [488, 488, "Tadjikistan"],
  [489, 489, "Hong Kong"],
  [490, 499, "Japonia"],
  [500, 509, "Regatul Unit"],
  [520, 521, "Grecia"],
  [528, 528, "Liban"],
  [529, 529, "Cipru"],
  [530, 530, "Albania"],
  [531, 531, "Macedonia de Nord"],
  [535, 535, "Malta"],
  [539, 539, "Irlanda"],
  [540, 549, "Belgia și Luxemburg"],
  [560, 560, "Portugalia"],
  [569, 569, "Islanda"],
  [570, 579, "Danemarca, Insulele Feroe și Groenlanda"],
  [590, 590, "Polonia"],
  [594, 594, "România"],
  [599, 599, "Ungaria"],
  [600, 601, "Africa de Sud"],
  [603, 603, "Ghana"],
  [604, 604, "Senegal"],
  [605, 605, "Uganda"],
  [606, 606, "Angola"],
  [607, 607, "Oman"],
  [608, 608, "Bahrain"],
  [609, 609, "Mauritius"],
  [611, 611, "Maroc"],
  [613, 613, "Algeria"],
  [615, 615, "Nigeria"],
  [616, 616, "Kenya"],
  [617, 617, "Camerun"],
  [618, 618, "Côte d’Ivoire"],
  [619, 619, "Tunisia"],
  [620, 620, "Tanzania"],
  [621, 621, "Siria"],
  [622, 622, "Egipt"],
  [623, 623, "Brunei"],
  [624, 624, "Libia"],
  [625, 625, "Iordania"],
  [626, 626, "Iran"],
  [627, 627, "Kuweit"],
  [628, 628, "Arabia Saudită"],
  [629, 629, "Emiratele Arabe Unite"],
  [630, 630, "Qatar"],
  [631, 631, "Namibia"],
  [640, 649, "Finlanda"],
  [690, 699, "China"],
  [700, 709, "Norvegia"],
  [729, 729, "Israel"],
  [730, 739, "Suedia"],
  [740, 740, "Guatemala"],
  [741, 741, "El Salvador"],
  [742, 742, "Honduras"],
  [743, 743, "Nicaragua"],
  [744, 744, "Costa Rica"],
  [745, 745, "Panama"],
  [746, 746, "Republica Dominicană"],
  [750, 750, "Mexic"],
  [754, 755, "Canada"],
  [759, 759, "Venezuela"],
  [760, 769, "Elveția și Liechtenstein"],
  [770, 771, "Columbia"],
  [773, 773, "Uruguay"],
  [775, 775, "Peru"],
  [777, 777, "Bolivia"],
  [778, 779, "Argentina"],
  [780, 780, "Chile"],
  [784, 784, "Paraguay"],
  [786, 786, "Ecuador"],
  [789, 790, "Brazilia"],
  [800, 839, "Italia, San Marino și Vatican"],
  [840, 849, "Spania și Andorra"],
  [850, 850, "Cuba"],
  [858, 858, "Slovacia"],
  [859, 859, "Cehia"],
  [860, 860, "Serbia"],
  [865, 865, "Mongolia"],
  [867, 867, "Coreea de Nord"],
  [868, 869, "Turcia"],
  [870, 879, "Țările de Jos"],
  [880, 881, "Coreea de Sud"],
  [883, 883, "Myanmar"],
  [884, 884, "Cambodgia"],
  [885, 885, "Thailanda"],
  [888, 888, "Singapore"],
  [890, 890, "India"],
  [893, 893, "Vietnam"],
  [896, 896, "Pakistan"],
  [899, 899, "Indonezia"],
  [900, 919, "Austria"],
  [930, 939, "Australia"],
  [940, 949, "Noua Zeelandă"],
  [950, 951, "GS1 Global Office", "special"],
  [955, 955, "Malaezia"],
  [958, 958, "Macao"],
  [960, 969, "GS1 Global Office (coduri scurte EAN-8)", "special"],
  [977, 977, "Publicații seriale (ISSN)", "serial"],
  [978, 979, "Cărți (ISBN)", "book"],
  [980, 980, "Bonuri de restituire", "coupon"],
  [981, 984, "Cupoane", "coupon"],
  [990, 999, "Cupoane", "coupon"],
];

/** Issuer of an EAN-13 by its first three digits; null when the input is not 13 digits. */
export function decodeGs1Prefix(ean: string): PrefixInfo | null {
  if (!/^\d{13}$/.test(ean)) return null;
  const prefix = ean.slice(0, 3);
  const n = Number(prefix);
  const hit = RANGES.find(([from, to]) => n >= from && n <= to);
  if (!hit) return { prefix, label: "Prefix nealocat de GS1", kind: "unassigned" };
  return { prefix, label: hit[2], kind: hit[3] ?? "country" };
}

export interface CheckDigitInfo {
  valid: boolean;
  /** Last digit as printed. */
  actual: number;
  /** Digit computed from the first 12. */
  expected: number;
}

/** Check digit of a 13-digit string, valid or not; null when the input is not 13 digits. */
export function checkDigitInfo(ean: string): CheckDigitInfo | null {
  if (!/^\d{13}$/.test(ean)) return null;
  const expected = eanCheckDigit(ean.slice(0, 12));
  if (expected === null) return null;
  const actual = Number(ean[12]);
  return { valid: actual === expected, actual, expected };
}

/** "5941234000013" -> "5 941234 000013", the grouping printed under EAN-13 bars. */
export function formatEan13(ean: string): string {
  return /^\d{13}$/.test(ean) ? `${ean[0]} ${ean.slice(1, 7)} ${ean.slice(7)}` : ean;
}

export type EanAnalysis =
  | { ok: false }
  | {
      ok: true;
      ean: string;
      prefix: PrefixInfo;
      check: CheckDigitInfo;
      /** Worth asking the catalogs: valid check digit and not an in-store code (20–29). */
      searchable: boolean;
    };

/** Spaces and dashes stripped, a 12-digit UPC-A gets its leading 0; decoded even when the check digit is wrong. */
export function analyzeEan(raw: string): EanAnalysis {
  const digits = raw.replace(/[\s-]/g, "");
  const ean = /^\d{12}$/.test(digits) ? `0${digits}` : digits;
  const prefix = decodeGs1Prefix(ean);
  const check = checkDigitInfo(ean);
  if (!prefix || !check) return { ok: false };
  return { ok: true, ean, prefix, check, searchable: check.valid && ean[0] !== "2" };
}

export function prefixNote(kind: PrefixKind): string {
  switch (kind) {
    case "country":
      return "Prefixul arată organizația GS1 care a alocat codul, nu neapărat țara în care a fost fabricat produsul.";
    case "restricted":
      return "Codurile cu acest prefix sunt create de magazin (cântar, produse vrac) și nu identifică un produs în afara lui.";
    case "coupon":
      return "Prefixul este rezervat pentru cupoane și bonuri, nu pentru produse.";
    case "book":
      return "Codurile 978–979 sunt coduri ISBN de cărți (979-0: ISMN, partituri).";
    case "serial":
      return "Codurile 977 sunt coduri ISSN de reviste și ziare.";
    case "special":
      return "Prefixul este gestionat direct de GS1 Global Office.";
    case "unassigned":
      return "GS1 nu a alocat acest prefix: verifică dacă ai tastat corect codul.";
    default: {
      const never: never = kind;
      throw new Error(`unexpected prefix kind ${String(never)}`);
    }
  }
}

/** Prefix and check digit panel. Input is digits only and labels are static, so nothing needs escaping. */
export function codeInfoHtml(a: Extract<EanAnalysis, { ok: true }>): string {
  const check = a.check.valid
    ? `<dd data-check="ok">${a.check.actual} — corectă</dd>`
    : `<dd data-check="bad" class="text-red-700">${a.check.actual} — greșită (cifra corectă ar fi ${a.check.expected})</dd>`;
  return `<dl>
<dt>Cod EAN-13</dt><dd class="font-mono">${formatEan13(a.ean)}</dd>
<dt>Prefix GS1</dt><dd data-prefix>${a.prefix.prefix} — ${a.prefix.label}</dd>
<dt>Cifra de control</dt>${check}
</dl><p class="ut-hint">${prefixNote(a.prefix.kind)}</p>`;
}
