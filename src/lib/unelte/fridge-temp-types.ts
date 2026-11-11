export type ApplianceKind = "frigider" | "congelator" | "vitrina" | "altul";

export interface FridgeAppliance {
  name: string;
  kind: ApplianceKind;
  /** User-defined limit; not a legal default. */
  temp_min?: number;
  temp_max?: number;
  /** Daily readings for this appliance (index 0 = day 1). */
  days?: FridgeTempDayReading[];
}

export interface FridgeTempDayReading {
  morning_temp?: string;
  morning_initials?: string;
  evening_temp?: string;
  evening_initials?: string;
  notes?: string;
}

export interface FridgeTempLogPayload {
  company: string;
  company_tax_id?: string;
  location?: string;
  month: number;
  year: number;
  appliances: FridgeAppliance[];
  /** Index 0 = day 1. Length = days in month when rendered. */
  days: FridgeTempDayReading[];
  responsible_name?: string;
  responsible_role?: string;
}

export interface CleaningZone {
  name: string;
}

export interface CleaningScheduleRow {
  date?: string;
  zone?: string;
  done?: boolean;
  initials?: string;
  notes?: string;
}

export interface FridgeCleaningLogPayload {
  company: string;
  location?: string;
  month: number;
  year: number;
  zones: CleaningZone[];
  rows: CleaningScheduleRow[];
  responsible_name?: string;
  responsible_role?: string;
}
