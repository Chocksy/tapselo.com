/** Fixed sign ids for analytics (never send free text). */
export const SIGN_IDS = [
  "casa_marcat",
  "program",
  "anpc",
  "sgr",
  "fumat",
  "minori_alcool_tutun",
] as const;

export type SignId = (typeof SIGN_IDS)[number];

export type PageOrientation = "portrait" | "landscape";

export interface ShopDetails {
  businessName: string;
  cui: string;
  address: string;
  logoDataUrl: string | null;
}

export interface DayHours {
  open: string;
  close: string;
}

export interface WeekSchedule {
  mon: DayHours | null;
  tue: DayHours | null;
  wed: DayHours | null;
  thu: DayHours | null;
  fri: DayHours | null;
  sat: DayHours | null;
  sun: DayHours | null;
  /** e.g. "13:00–14:00" */
  breakLabel: string;
  closedNotes: string;
}

export interface AnpcContact {
  countyId: string;
  commissionName: string;
  address: string;
  phone: string;
  email: string;
}

export interface ToolState {
  selected: SignId[];
  shop: ShopDetails;
  schedule: WeekSchedule;
  anpc: AnpcContact;
  /** Optional extended bon fiscal lines from Ordin MF 159/2015 annex (OUG 28/1999). */
  casaMarcatExtended: boolean;
  /** SGR: shop accepts returns at this location */
  sgrAcceptsReturns: boolean;
  sgrReturnAddress: string;
  sgrReturnHours: string;
  /** When false, show HG 1074/2021 text for shops without return point */
  sgrHasReturnPoint: boolean;
}

export interface RenderedSign {
  id: SignId;
  title: string;
  landscape: boolean;
  bodyHtml: string;
}
