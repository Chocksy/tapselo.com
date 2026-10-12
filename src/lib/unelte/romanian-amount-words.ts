// Romanian amount in words for cash documents (lei + bani). Used by dispoziție de plată/încasare.

const UNITS_F = ["", "una", "două", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
const UNITS_M = ["", "un", "două", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
const TEENS = [
  "zece",
  "unsprezece",
  "doisprezece",
  "treisprezece",
  "paisprezece",
  "cincisprezece",
  "șaisprezece",
  "șaptesprezece",
  "optsprezece",
  "nouăsprezece",
];
const TENS = ["", "zece", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

function under100(n: number, feminine: boolean): string {
  if (n === 0) return "";
  const units = feminine ? UNITS_F : UNITS_M;
  if (n < 10) return units[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]} și ${units[u]}` : TENS[t];
}

function under1000(n: number, feminine: boolean): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let head = "";
  if (h === 1) head = "o sută";
  else if (h > 1) head = `${UNITS_F[h]} sute`;
  const tail = under100(rest, feminine);
  if (!head) return tail;
  if (!tail) return head;
  const sep = rest > 0 && rest < 20 ? " și " : " ";
  return `${head}${sep}${tail}`;
}

/** Integer 0..999_999_999 in Romanian words (feminine agreement for „mie”). */
export function integerInRomanianWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new RangeError("integerInRomanianWords expects a non-negative integer");
  }
  if (n === 0) return "zero";

  const chunks: string[] = [];
  let rest = n;
  const millions = Math.floor(rest / 1_000_000);
  rest %= 1_000_000;
  if (millions) {
    if (millions === 1) chunks.push("un milion");
    else chunks.push(`${integerInRomanianWords(millions)} milioane`);
  }

  const thousands = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousands) {
    if (thousands === 1) chunks.push("o mie");
    else chunks.push(`${under1000(thousands, true)} mii`);
  }

  const last = under1000(rest, true);
  if (last) chunks.push(last);
  return chunks.join(" ");
}

function leiLabel(lei: number): string {
  if (lei === 1) return "un leu";
  return "lei";
}

function baniPart(bani: number): string {
  if (bani === 0) return "";
  const words = under100(bani, true);
  if (bani === 1) return "un ban";
  return `${words} bani`;
}

/**
 * Converts a monetary amount (2 decimals) to Romanian words for dispoziții / chitanțe.
 * Examples: 1 -> „un leu”; 2.50 -> „două lei și cincizeci de bani”.
 */
export function amountInRomanianWords(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError("amount must be finite");
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < 0) throw new RangeError("amount must be non-negative");
  const lei = Math.floor(rounded);
  const bani = Math.round((rounded - lei) * 100);

  const leiWords = lei === 0 ? "zero" : integerInRomanianWords(lei);
  const leiPhrase = lei === 1 ? "un leu" : `${leiWords} ${leiLabel(lei)}`.trim();

  const baniPhrase = baniPart(bani);
  if (!baniPhrase) return leiPhrase;
  if (lei === 0) return baniPhrase;
  return `${leiPhrase} și ${baniPhrase}`;
}
