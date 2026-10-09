const yn = (b) => (b ? "da" : "nu");

export function efacturaRegistryValue(registry, since) {
  if (registry) return since && since.trim() ? `da (din ${since})` : "da";
  return "nu apare în Registrul RO e-Factura";
}

export function companyHtml(c) {
  const rows = [
    ["Denumire", c.name || "—"],
    ["Adresă", c.address || "—"],
    ["Plătitor de TVA", yn(c.vat_payer)],
    ["TVA la încasare", yn(c.vat_on_cash)],
    ["Inactiv fiscal", yn(c.inactive)],
    ["Split TVA", yn(c.split_vat)],
    ["Registrul RO e-Factura", efacturaRegistryValue(c.efactura_registry, c.efactura_since)],
  ];
  if (c.registration_number) rows.push(["Nr. Registrul Comerțului", c.registration_number]);
  if (c.caen) rows.push(["Cod CAEN", c.caen]);
  if (c.status) rows.push(["Stare înregistrare", c.status]);
  if (c.deregistered_on) rows.push(["Radiată la", c.deregistered_on]);
  if (c.date) rows.push(["Data interogării ANAF", c.date]);
  return rows
    .map(
      ([label, value]) =>
        `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join("");
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
