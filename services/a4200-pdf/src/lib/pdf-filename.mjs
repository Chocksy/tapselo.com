function latin1(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

/**
 * @param {Buffer | Uint8Array} opisBytes
 */
export function buildPdfDownloadName(opisBytes) {
  const text = latin1(opisBytes);
  const idM = text.match(/\bidM="([^"]+)"/i)?.[1];
  const nui = idM?.slice(0, 10) ?? text.match(/\bnui="(\d{10})"/i)?.[1] ?? "NUI";
  const nrRapI = text.match(/\bnrRapI="(\d+)"/i)?.[1] ?? "?";
  const nrRapF = text.match(/\bnrRapF="(\d+)"/i)?.[1] ?? "?";
  return `A4200_${nui}_Z${nrRapI}-Z${nrRapF}.pdf`;
}
