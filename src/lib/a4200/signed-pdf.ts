import { stripPdfLtvIncrement } from "./strip-pdf-ltv.ts";

const PDF_HEADER = "%PDF-";
const SIG_MARKERS = [/\/Type\s*\/Sig\b/, /\/SubFilter\s*\/adbe\.pkcs7/, /\/ByteRange\s*\[/];

export type SignedPdfErrorCode = "not_pdf" | "unsigned" | "broken_signature" | "tampered";

export interface PrepareSignedPdfForAnafResult {
  ok: true;
  bytes: Uint8Array;
  strippedIncrement: boolean;
  downloadName: string;
}

export interface PrepareSignedPdfForAnafError {
  ok: false;
  code: SignedPdfErrorCode;
  message: string;
}

export type PrepareSignedPdfForAnafOutcome = PrepareSignedPdfForAnafResult | PrepareSignedPdfForAnafError;

export function anafExportFilename(originalName: string): string {
  const base = originalName.replace(/\.pdf$/i, "").replace(/-anaf$/i, "").replace(/_PENTRU-ANAF$/i, "");
  return `${base}_PENTRU-ANAF.pdf`;
}

function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  const head = decodeLatin1(bytes.subarray(0, 5));
  return head === PDF_HEADER;
}

function parseByteRangeNumbers(numbersPart: string): number[] | null {
  const nums = numbersPart
    .trim()
    .split(/\s+/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4 || nums.length % 2 !== 0) return null;
  return nums;
}

function lastByteRangeMatch(text: string): RegExpExecArray | null {
  const re = /\/ByteRange\s*\[\s*((?:\d+\s*)+)\]/g;
  let match: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    match = m;
  }
  return match;
}

/** Structural check: ByteRange pairs lie in file and standard two-part layout matches file length (LTV tail allowed). */
export function isByteRangeStructurallyIntact(bytes: Uint8Array, numbersPart: string): boolean {
  const nums = parseByteRangeNumbers(numbersPart);
  if (!nums) return false;
  let coveredEnd = 0;
  for (let i = 0; i < nums.length; i += 2) {
    const off = nums[i];
    const len = nums[i + 1];
    if (off < 0 || len < 0 || off + len > bytes.length) return false;
    coveredEnd = Math.max(coveredEnd, off + len);
  }
  if (nums.length >= 4) {
    const gapStart = nums[0] + nums[1];
    const gapEnd = nums[2];
    if (gapEnd < gapStart) return false;
    const signedBodyEnd = nums[2] + nums[3];
    if (signedBodyEnd > bytes.length) return false;
    if (coveredEnd > signedBodyEnd) return false;
    // Bytes after signedBodyEnd may be LTV/DSS increment (stripped later).
    if (gapEnd - gapStart < 2) return false;
  }
  return true;
}

export function looksSignedPdf(text: string): boolean {
  if (!/\/ByteRange\s*\[/.test(text)) return false;
  return SIG_MARKERS.some((re) => re.test(text));
}

export function prepareSignedPdfForAnaf(
  pdf: Uint8Array | ArrayBuffer,
  originalFilename: string,
): PrepareSignedPdfForAnafOutcome {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);

  if (!isPdfBytes(bytes)) {
    return {
      ok: false,
      code: "not_pdf",
      message: "Fișierul nu pare a fi un PDF. Alege PDF-ul semnat (extensia .pdf).",
    };
  }

  const text = decodeLatin1(bytes);
  if (!looksSignedPdf(text)) {
    return {
      ok: false,
      code: "unsigned",
      message:
        "PDF-ul nu pare semnat electronic. Semnează-l o singură dată cu certificatul firmei, apoi încarcă același fișier aici.",
    };
  }

  const br = lastByteRangeMatch(text);
  if (!br?.[1]) {
    return {
      ok: false,
      code: "unsigned",
      message:
        "Nu am găsit o semnătură validă în PDF. Semnează documentul înainte de încărcare.",
    };
  }

  if (!isByteRangeStructurallyIntact(bytes, br[1])) {
    return {
      ok: false,
      code: "broken_signature",
      message:
        "Semnătura din PDF pare stricată sau fișierul a fost modificat după semnare. Descarcă din nou PDF-ul de la pasul 1, semnează-l și încarcă-l fără alte editări.",
    };
  }

  const strip = stripPdfLtvIncrement(bytes);
  if (!strip.ok || !strip.stripped) {
    return {
      ok: false,
      code: "tampered",
      message: strip.reason ?? "Nu am putut pregăti PDF-ul pentru ANAF. Încearcă din nou.",
    };
  }

  if (!isByteRangeStructurallyIntact(strip.stripped, br[1])) {
    return {
      ok: false,
      code: "tampered",
      message:
        "Fișierul semnat nu mai corespunde semnăturii (probabil a fost resalvat sau editat). Folosește PDF-ul proaspăt semnat.",
    };
  }

  return {
    ok: true,
    bytes: strip.stripped,
    strippedIncrement: strip.strippedIncrement === true,
    downloadName: anafExportFilename(originalFilename || "declarare.pdf"),
  };
}
