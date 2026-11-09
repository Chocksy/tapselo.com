import { faqPageJsonLd, type FaqItem } from "./unelte/jsonld.ts";

/** Visible homepage FAQ: keep claims aligned with /ghid/articole/casa-de-marcat-fara-internet/ and product copy. */
export const homepageFaq: FaqItem[] = [
  {
    q: "Tapselo funcționează fără internet?",
    a:
      "Da, pentru vânzarea la casă: programul POS rulează pe calculator (Windows, macOS sau Linux), emite bonul fiscal la imprimanta legată local și salvează vânzările pe dispozitiv când pică internetul. La reconectare, datele se sincronizează în contul Tapselo. Pe iPhone, aplicația Tapselo vinde și trimite bonul la casa de marcat Datecs, prin rețea sau Bluetooth; tot din telefon faci inventarul. Conectarea AMEF către ANAF rămâne obligația ta, conform legii; detalii în ghidul casa de marcat fără internet.",
  },
  {
    q: "Pe ce dispozitive rulează casa de marcat Tapselo?",
    a:
      "Casa de marcat (POS) rulează pe Windows, macOS sau Linux, de obicei pe un PC sau un kiosk la tejghea. Pe iPhone, aplicația Tapselo vinde, încasează cu cardul pe telefon și trimite bonul la casa de marcat Datecs, prin rețea sau Bluetooth.",
  },
  {
    q: "Cât costă Tapselo după perioada beta?",
    a:
      "În beta, aplicația este gratuită, fără card, cu preaviz de 30 de zile înainte de tarif. După beta: plan Start 79 lei/lună + TVA (o casă), plan Magazin 129 lei/lună + TVA (două case); casă suplimentară +39 lei/lună + TVA.",
  },
];

export function homepageFaqJsonLd(): Record<string, unknown> {
  return faqPageJsonLd(homepageFaq);
}
