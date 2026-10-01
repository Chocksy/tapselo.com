// Text helpers shared by the answer tools: normalization, KB search, Romanian formatting.
// Pure functions; no imports so they run under node --test as is.

/** Common knowledge base entry shape (src/lib/kb/*.json). */
export interface KbEntry {
  id: string;
  title: string;
  summary: string;
  body: string;
  keywords: string[];
  sources: { title: string; url: string }[];
  verified_on: string;
  page: string;
  [extra: string]: unknown;
}

/** Lower case, no diacritics, only letters/digits separated by single spaces. */
export function normalize(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Words that carry no meaning for search (Romanian + a few English).
const STOPWORDS = new Set(
  (
    "a ai al ale am ar as asa ca care ce cei cel cu cum da de del din dupa e ea el este eu fi fie " +
    "imi in indi la le li lui ma mai mi ne nu o ori pe pentru pana pot poate sa se si sunt te tu un " +
    "una unei unui va vreau vrea cat cand unde fac face trebuie imi meu mea mele mei nostru noastra " +
    "the and or of to for is are what how"
  ).split(" "),
);

/** Normalized search tokens, without stopwords. */
export function tokenize(s: unknown): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Romanian inflects word endings ("painea", "painii", "paine"), so two tokens match
// when they are equal or share a stem of at least 4 characters.
function stemMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  const stem = Math.max(4, n - 2);
  return a.slice(0, stem) === b.slice(0, stem);
}

function fieldScore(tokens: string[], field: string[]): number {
  let hits = 0;
  for (const t of tokens) if (field.some((f) => stemMatch(t, f))) hits++;
  return hits;
}

/**
 * Rank entries for a free text query.
 * Keywords weigh most, then title, summary, body. A multi-word keyword found as a phrase in
 * the query gets a bonus. Entries with score 0 are dropped.
 */
export function searchEntries<T extends KbEntry>(entries: readonly T[], query: string, limit = 3): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const nq = ` ${normalize(query)} `;
  const scored = entries.map((e, i) => {
    const keywords = (e.keywords ?? []).map(normalize);
    const kwTokens = keywords.flatMap((k) => k.split(" "));
    let score =
      3 * fieldScore(tokens, kwTokens) +
      2 * fieldScore(tokens, tokenize(e.title)) +
      1 * fieldScore(tokens, tokenize(e.summary)) +
      0.5 * fieldScore(tokens, tokenize(e.body));
    for (const k of keywords) if (k.includes(" ") && nq.includes(` ${k} `)) score += 4;
    return { e, i, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.e);
}

/** Accepts an array or an object holding one array (`entries`, `items`, `vendors`, ...). */
export function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const v of Object.values(data as Record<string, unknown>)) if (Array.isArray(v)) return v as T[];
  }
  return [];
}

/** 1234.5 -> "1.234,50" (Romanian grouping and decimal comma). */
export function formatNumber(n: number, decimals = 2): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = n < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + grouped + (frac ? `,${frac}` : "");
}

/** 12.99 -> "12,99 lei". */
export function formatLei(n: number): string {
  return `${formatNumber(n, 2)} lei`;
}

/** 21 -> "21%", 12.5 -> "12,5%". */
export function formatPercent(n: number): string {
  return `${formatNumber(n, 2).replace(/,?0+$/, "")}%`;
}

/** "YYYY-MM-DD" -> "DD.MM.YYYY"; anything else as is. */
export function formatDateRo(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? "");
}

/** Makes a value safe inside a markdown table cell. */
export function cell(v: unknown): string {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

/** Today in Romania as YYYY-MM-DD. */
export function todayBucharest(now = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
}
