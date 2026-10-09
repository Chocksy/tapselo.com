import type { CompanyInfo } from "./types.ts";

const yn = (b: boolean) => (b ? "da" : "nu");

/** RO e-Factura register value — when false, never imply the firm is not obliged to use e-Factura. */
export function efacturaRegistryValue(registry: boolean, since: string | null): string {
  if (registry) {
    return since && since.trim() ? `da (din ${since})` : "da";
  }
  return "nu apare în Registrul RO e-Factura";
}

export interface CompanyDisplayRow {
  label: string;
  value: string;
}

export function companyDisplayRows(c: CompanyInfo): CompanyDisplayRow[] {
  const rows: CompanyDisplayRow[] = [
    { label: "Denumire", value: c.name || "—" },
    { label: "Adresă", value: c.address || "—" },
    { label: "Plătitor de TVA", value: yn(c.vat_payer) },
    { label: "TVA la încasare", value: yn(c.vat_on_cash) },
    { label: "Inactiv fiscal", value: yn(c.inactive) },
    { label: "Split TVA", value: yn(c.split_vat) },
    { label: "Registrul RO e-Factura", value: efacturaRegistryValue(c.efactura_registry, c.efactura_since) },
  ];
  if (c.registration_number) rows.push({ label: "Nr. Registrul Comerțului", value: c.registration_number });
  if (c.caen) rows.push({ label: "Cod CAEN", value: c.caen });
  if (c.status) rows.push({ label: "Stare înregistrare", value: c.status });
  if (c.deregistered_on) rows.push({ label: "Radiată la", value: c.deregistered_on });
  if (c.date) rows.push({ label: "Data interogării ANAF", value: c.date });
  return rows;
}
