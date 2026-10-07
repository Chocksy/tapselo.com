import { A4203_NS, A4200_NS } from "./constants.ts";
import type { FileKind } from "./types.ts";

const XML_DECL = "<?xml";

function toBytes(input: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

function bytesToLatin1(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

function detectKind(xml: string): FileKind {
  const t = xml.trim();
  if (/<mReg[\s>]/.test(t) || t.includes(A4200_NS)) return "opis";
  if (/<msj[\s>]/.test(t) || t.includes(A4203_NS)) return "day";
  return "foreign";
}

function closeTagFor(kind: FileKind): string | null {
  if (kind === "opis") return "</mReg>";
  if (kind === "day") return "</msj>";
  return null;
}

/**
 * Pull embedded fiscal XML from PKCS#7 (.p7b), plain XML, or UTF-8 text with binary prefix.
 * Tolerant of CMS wrappers: scans for `<?xml` … `</mReg>` or `</msj>`.
 */
export function extractXmlPayload(input: Uint8Array | ArrayBuffer | string): { xml: string; kind: FileKind } | null {
  const bytes = toBytes(input);
  const text = bytesToLatin1(bytes);
  const start = text.indexOf(XML_DECL);
  if (start === -1) return null;

  const tail = text.slice(start);
  const opisEnd = tail.indexOf("</mReg>");
  const dayEnd = tail.indexOf("</msj>");

  let xml: string;
  let kind: FileKind;
  if (opisEnd !== -1 && (dayEnd === -1 || opisEnd < dayEnd)) {
    xml = tail.slice(0, opisEnd + "</mReg>".length);
    kind = "opis";
  } else if (dayEnd !== -1) {
    xml = tail.slice(0, dayEnd + "</msj>".length);
    kind = "day";
  } else {
    const probe = tail.slice(0, Math.min(tail.length, 8000));
    kind = detectKind(probe);
    const close = closeTagFor(kind);
    if (!close) return null;
    const end = tail.indexOf(close);
    if (end === -1) return null;
    xml = tail.slice(0, end + close.length);
  }

  return { xml, kind: detectKind(xml) };
}

export function isLikelyP7b(name: string, bytes: Uint8Array): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith(".p7b") || lower.endsWith(".p7s")) return true;
  if (bytes.length > 4 && bytes[0] === 0x30) return true;
  return false;
}
