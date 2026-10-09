export function parseAnafResponse(text, cui) {
  const data = JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " "));
  if (!Array.isArray(data.found)) throw new Error("unexpected ANAF shape");
  const row = data.found.find((r) => String(r?.date_generale?.cui) === cui);
  if (!row) return null;
  const g = row.date_generale ?? {};
  const inactive = row.stare_inactiv ?? {};
  return {
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
  };
}
