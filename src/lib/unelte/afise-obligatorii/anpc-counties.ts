/** Regional CPC contacts — editable in the tool; defaults from public ANPC listings. */
export interface AnpcCounty {
  id: string;
  label: string;
  commissionName: string;
  address: string;
  phone: string;
  email: string;
}

export const ANPC_SAL_PHONE = "021 9551";
export const ANPC_SAL_URL = "https://anpc.ro/sal/";
export const ANPC_COMPLAINT_URL = "https://anpc.ro/depune-o-plangere/";
export const EU_ODR_URL = "https://ec.europa.eu/consumers/odr";

export const anpcCounties: AnpcCounty[] = [
  {
    id: "bucuresti",
    label: "București",
    commissionName: "Comisariatul Municipiului București pentru Protecția Consumatorilor",
    address: "Bulevardul Aviatorilor nr. 72, sector 1, București",
    phone: "021 9551",
    email: "contact@anpc.ro",
  },
  {
    id: "cluj",
    label: "Cluj",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Cluj",
    address: "Str. Memorandumului nr. 28, Cluj-Napoca",
    phone: "0264 431 367",
    email: "cj_cluj@anpc.ro",
  },
  {
    id: "timis",
    label: "Timiș",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Timiș",
    address: "Bd. Revoluția din 1989 nr. 7, Timișoara",
    phone: "0256 491 821",
    email: "cj_timis@anpc.ro",
  },
  {
    id: "iasi",
    label: "Iași",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Iași",
    address: "Str. Sfântul Lazar nr. 37, Iași",
    phone: "0232 267 891",
    email: "cj_iasi@anpc.ro",
  },
  {
    id: "brasov",
    label: "Brașov",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Brașov",
    address: "Str. Iuliu Maniu nr. 44, Brașov",
    phone: "0268 477 250",
    email: "cj_brasov@anpc.ro",
  },
  {
    id: "constanta",
    label: "Constanța",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Constanța",
    address: "Bd. Tomis nr. 305, Constanța",
    phone: "0241 617 530",
    email: "cj_constanta@anpc.ro",
  },
  {
    id: "dolj",
    label: "Dolj",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor Dolj",
    address: "Str. Popa Șapcă nr. 6, Craiova",
    phone: "0251 411 384",
    email: "cj_dolj@anpc.ro",
  },
  {
    id: "alta",
    label: "Alt județ (completez manual)",
    commissionName: "Comisariatul Județean pentru Protecția Consumatorilor",
    address: "",
    phone: "",
    email: "",
  },
];

export function countyById(id: string): AnpcCounty {
  return anpcCounties.find((c) => c.id === id) ?? anpcCounties[0];
}
