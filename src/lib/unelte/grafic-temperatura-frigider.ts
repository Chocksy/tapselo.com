/** Mandatory notice above the form (TAP-FRIGIDER brief). */
export const TEMP_LEGAL_NOTICE =
  "Regulamentul (CE) 852/2004 cere monitorizarea temperaturilor adecvate și, dacă este nevoie, înregistrarea lor. Nu am găsit un formular legal cu denumirea «grafic de temperatură». Limitele min/max le completați dumneavoastră, din eticheta produsului sau din cerințele aplicabile alimentelor pe care le țineți. Valorile precompletate sunt doar exemple, nu limite legale generale.";

export const CLEANING_TAB_NOTICE =
  "Curățarea și dezinfectarea incintelor sunt cerute de anexa II cap. I din Regulamentul (CE) 852/2004. Acest tab este un model opțional de grafic — nu am găsit un formular legal cu această denumire.";

export const SOURCES_VERIFIED = "2026-11-10";

export const LEGAL_SOURCES = {
  reg852: {
    label: "EUR-Lex — Regulamentul (CE) nr. 852/2004 (forma consolidată)",
    href: "https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:02004R0852-20210324",
  },
  ansvsa: {
    label: "ANSVSA — Referat de evaluare (unități de comercializare)",
    href: "https://www.ansvsa.ro/download/rechemare_produse_alimentare/rr_referate_evaluare/Referat-evaluare-in-vederea-inregistrarii-a-unitatilor-de-comercializare-inclusiv-depozite-alimentare.pdf",
  },
} as const;
