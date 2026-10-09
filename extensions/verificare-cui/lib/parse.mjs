function sanitize(text) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
}

export function looksLikeHtmlResponse(text) {
  const t = text.trimStart().slice(0, 64).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}

export function cuiEquals(a, b) {
  const left = String(a ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const right = String(b ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return left.length > 0 && left === right;
}

function pickFoundRow(data, cui) {
  const found = Array.isArray(data.found) ? data.found : [];
  if (!found.length) return null;
  return found.find((r) => cuiEquals(r?.date_generale?.cui, cui)) ?? null;
}

function isCuiListedNotFound(data, cui) {
  if (!Array.isArray(data.notFound)) return false;
  return data.notFound.some((n) => cuiEquals(n, cui));
}

export function interpretAnafResponse(text, cui) {
  if (looksLikeHtmlResponse(text)) return { kind: "unavailable" };
  let data;
  try {
    data = JSON.parse(sanitize(text));
  } catch {
    return { kind: "unavailable" };
  }
  if (!Array.isArray(data.found)) return { kind: "unavailable" };
  const row = pickFoundRow(data, cui);
  if (!row) {
    if (isCuiListedNotFound(data, cui) || data.found.length === 0) return { kind: "not_found" };
    return { kind: "unavailable" };
  }
  const g = row.date_generale ?? {};
  const inactive = row.stare_inactiv ?? {};
  return {
    kind: "ok",
    company: {
      cui,
      name: g.denumire?.trim() ?? "",
      address: g.adresa?.trim() ?? "",
      registration_number: g.nrRegCom?.trim() || null,
      caen: g.cod_CAEN?.trim() || null,
      status: g.stare_inregistrare?.trim() || null,
      vat_payer: row.inregistrare_scop_Tva?.scpTVA === true,
      vat_on_cash: row.inregistrare_RTVAI?.statusTvaIncasare === true,
      split_vat: row.inregistrare_SplitTVA?.statusSplitTVA === true,
      inactive: inactive.statusInactivi === true,
      deregistered_on: inactive.dataRadiere?.trim() || null,
      efactura_registry: g.statusRO_e_Factura === true,
      efactura_since: g.data_inreg_Reg_RO_e_Factura?.trim() || null,
      date: g.data?.trim() ?? "",
    },
  };
}
