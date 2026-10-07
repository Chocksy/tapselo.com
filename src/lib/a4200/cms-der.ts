/** Minimal BER/DER reader for PKCS#7 SignedData eContent (Datecs multi-chunk OCTET STRINGs). */

const SIGNED_DATA_OID = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
const DATA_OID = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);

export interface Tlv {
  tag: number;
  constructed: boolean;
  valueStart: number;
  valueEnd: number;
  nextOffset: number;
}

function readLength(bytes: Uint8Array, offset: number): { length: number | null; next: number } {
  if (offset >= bytes.length) throw new Error("DER truncated");
  const first = bytes[offset];
  if (first < 0x80) return { length: first, next: offset + 1 };
  const numOctets = first & 0x7f;
  if (numOctets === 0) return { length: null, next: offset + 1 };
  let length = 0;
  for (let i = 0; i < numOctets; i++) {
    length = (length << 8) | bytes[offset + 1 + i];
  }
  return { length, next: offset + 1 + numOctets };
}

function endOfIndefiniteValue(bytes: Uint8Array, valueStart: number): number {
  let off = valueStart;
  while (off < bytes.length) {
    if (bytes[off] === 0x00 && off + 1 < bytes.length && bytes[off + 1] === 0x00) {
      return off;
    }
    const tlv = readTlv(bytes, off);
    off = tlv.nextOffset;
  }
  throw new Error("DER missing EOC");
}

export function readTlv(bytes: Uint8Array, offset: number): Tlv {
  if (offset >= bytes.length) throw new Error("DER truncated");
  const tag = bytes[offset];
  const constructed = (tag & 0x20) !== 0;
  const { length, next } = readLength(bytes, offset + 1);
  const valueStart = next;

  if (length === null) {
    if (!constructed) throw new Error("DER indefinite length on primitive");
    const valueEnd = endOfIndefiniteValue(bytes, valueStart);
    return { tag, constructed, valueStart, valueEnd, nextOffset: valueEnd + 2 };
  }

  const valueEnd = valueStart + length;
  if (valueEnd > bytes.length) throw new Error("DER length past buffer");
  return { tag, constructed, valueStart, valueEnd, nextOffset: valueEnd };
}

function oidEquals(bytes: Uint8Array, start: number, end: number, expected: Uint8Array): boolean {
  if (end - start !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (bytes[start + i] !== expected[i]) return false;
  }
  return true;
}

function collectOctetStringLeaves(bytes: Uint8Array, start: number, end: number, out: Uint8Array[]): void {
  let off = start;
  while (off < end) {
    const tlv = readTlv(bytes, off);
    if (tlv.tag === 0x04) {
      if (tlv.constructed) {
        collectOctetStringLeaves(bytes, tlv.valueStart, tlv.valueEnd, out);
      } else {
        out.push(bytes.subarray(tlv.valueStart, tlv.valueEnd));
      }
    } else if (tlv.constructed) {
      collectOctetStringLeaves(bytes, tlv.valueStart, tlv.valueEnd, out);
    }
    off = tlv.nextOffset;
  }
}

function extractFromEncapContentInfo(bytes: Uint8Array, start: number, end: number): Uint8Array | null {
  let off = start;
  let sawDataOid = false;
  while (off < end) {
    const tlv = readTlv(bytes, off);
    if (tlv.tag === 0x06 && oidEquals(bytes, tlv.valueStart, tlv.valueEnd, DATA_OID)) {
      sawDataOid = true;
    } else if (sawDataOid && tlv.tag === 0xa0) {
      const chunks: Uint8Array[] = [];
      collectOctetStringLeaves(bytes, tlv.valueStart, tlv.valueEnd, chunks);
      if (chunks.length === 0) return null;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let pos = 0;
      for (const c of chunks) {
        merged.set(c, pos);
        pos += c.length;
      }
      return merged;
    }
    off = tlv.nextOffset;
  }
  return null;
}

/**
 * Extract PKCS#7 SignedData encapsulated content (concatenated OCTET STRING chunks).
 * Returns null if the buffer is not CMS SignedData we recognize.
 */
export function extractPkcs7SignedDataPayload(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0x30) return null;
  try {
    const root = readTlv(bytes, 0);
    if (root.tag !== 0x30) return null;

    let off = root.valueStart;
    const rootEnd = root.valueEnd;
    const typeTlv = readTlv(bytes, off);
    if (typeTlv.tag !== 0x06 || !oidEquals(bytes, typeTlv.valueStart, typeTlv.valueEnd, SIGNED_DATA_OID)) {
      return null;
    }

    off = typeTlv.nextOffset;
    const contentWrap = readTlv(bytes, off);
    if (contentWrap.tag !== 0xa0) return null;

    const signedData = readTlv(bytes, contentWrap.valueStart);
    if (signedData.tag !== 0x30) return null;

    return findEncapContentInSignedData(bytes, signedData.valueStart, signedData.valueEnd);
  } catch {
    return null;
  }
}

function findEncapContentInSignedData(bytes: Uint8Array, start: number, end: number): Uint8Array | null {
  let off = start;
  let child = 0;
  while (off < end) {
    const tlv = readTlv(bytes, off);
    if (child === 2 && tlv.tag === 0x30) {
      return extractFromEncapContentInfo(bytes, tlv.valueStart, tlv.valueEnd);
    }
    off = tlv.nextOffset;
    child++;
  }
  return null;
}
