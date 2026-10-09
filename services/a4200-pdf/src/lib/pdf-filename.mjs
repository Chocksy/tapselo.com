function latin1(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

function periodFromDayXml(text) {
  const an = text.match(/\ban="(\d{4})"/i)?.[1];
  const luna = text.match(/\bluna="(\d{1,2})"/i)?.[1];
  if (an && luna) {
    const y = Number.parseInt(an, 10);
    const m = Number.parseInt(luna, 10);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) return { y, m };
  }
  const idM =
    text.match(/<msj\b[^>]*\bidM="(\d+)"/i)?.[1] ?? text.match(/\bidM="(\d{20,})"/i)?.[1];
  if (!idM || idM.length < 16) return null;
  const y = Number.parseInt(idM.slice(10, 14), 10);
  const m = Number.parseInt(idM.slice(14, 16), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

/**
 * Prefer calendar month from day files (an/luna on msj), not opis export timestamp.
 * @param {Map<string, Buffer> | Record<string, Buffer | Uint8Array>} p7bMap
 */
export function inferMonthFromDayFiles(p7bMap) {
  const entries = p7bMap instanceof Map ? [...p7bMap.entries()] : Object.entries(p7bMap);
  const counts = new Map();
  for (const [name, data] of entries) {
    if (!name.toLowerCase().endsWith(".p7b")) continue;
    const text = latin1(data);
    const isDay = /_Z\d{1,4}\.p7b$/i.test(name) || /<msj\b/i.test(text);
    if (!isDay) continue;
    const p = periodFromDayXml(text);
    if (!p) continue;
    const key = `${p.y}-${String(p.m).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = key;
    }
  }
  return best;
}

/**
 * @param {Buffer | Uint8Array} opisBytes
 * @param {Map<string, Buffer> | Record<string, Buffer | Uint8Array>} [allP7b]
 */
export function buildPdfDownloadName(opisBytes, allP7b) {
  const text = latin1(opisBytes);
  const idM = text.match(/\bidM="([^"]+)"/i)?.[1];
  const nui = idM?.slice(0, 10) ?? text.match(/\bnui="(\d{10})"/i)?.[1] ?? "NUI";
  const nrRapI = text.match(/\bnrRapI="(\d+)"/i)?.[1] ?? "?";
  const nrRapF = text.match(/\bnrRapF="(\d+)"/i)?.[1] ?? "?";
  const monthKey = (allP7b && inferMonthFromDayFiles(allP7b)) ?? null;
  const suffix = monthKey ? `_${monthKey}` : "";
  return `A4200_${nui}${suffix}_Z${nrRapI}-Z${nrRapF}.pdf`;
}
