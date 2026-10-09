export interface CompanyInfo {
  cui: string;
  name: string;
  address: string;
  registration_number: string | null;
  caen: string | null;
  status: string | null;
  vat_payer: boolean;
  vat_on_cash: boolean;
  split_vat: boolean;
  inactive: boolean;
  deregistered_on: string | null;
  efactura_registry: boolean;
  efactura_since: string | null;
  date: string;
}
