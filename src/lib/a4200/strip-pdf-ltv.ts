/**
 * Truncate a signed PDF at the end of the last signature ByteRange (strips webSIGN LTV/DSS tail).
 */

const BYTE_RANGE_RE = /\/ByteRange\s*\[\s*((?:\d+\s*)+)\]/g;

function parseByteRangeEnd(numbersPart: string): number | null {
  const nums = numbersPart
    .trim()
    .split(/\s+/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4 || nums.length % 2 !== 0) return null;
  let end = 0;
  for (let i = 0; i < nums.length; i += 2) {
    end = Math.max(end, nums[i] + nums[i + 1]);
  }
  return end;
}

function lastByteRangeEnd(text: string): number | null {
  BYTE_RANGE_RE.lastIndex = 0;
  let end: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = BYTE_RANGE_RE.exec(text)) !== null) {
    const parsed = parseByteRangeEnd(match[1] ?? "");
    if (parsed !== null) end = parsed;
  }
  return end;
}

export interface StripLtvResult {
  ok: boolean;
  stripped?: Uint8Array;
  endOffset?: number;
  strippedIncrement?: boolean;
  reason?: string;
}

export function stripPdfLtvIncrement(pdf: Uint8Array | ArrayBuffer): StripLtvResult {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  const text = new TextDecoder("latin1").decode(bytes);
  const end = lastByteRangeEnd(text);
  if (end === null) {
    return { ok: false, reason: "Nu am găsit ByteRange în PDF. Fișierul pare nesemnat sau corupt." };
  }
  if (end <= 0 || end > bytes.length) {
    return { ok: false, reason: "ByteRange din PDF nu poate fi interpretat." };
  }
  if (end >= bytes.length) {
    return { ok: true, stripped: bytes, endOffset: end, strippedIncrement: false };
  }
  return {
    ok: true,
    stripped: bytes.subarray(0, end),
    endOffset: end,
    strippedIncrement: true,
  };
}
