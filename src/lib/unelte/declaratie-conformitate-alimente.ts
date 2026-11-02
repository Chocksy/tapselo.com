/** Copy and legal sources for /unelte/declaratie-de-conformitate-produse-alimentare/ (TAP-033). */

export const VOLUNTARY_NOTICE =
  "Nicio lege nu obligă producătorul să emită o declarație de conformitate pentru alimentul în sine. Documentul este o declarație voluntară, pe propria răspundere, pe care o cer de obicei cumpărătorii prin contract. Nu înlocuiește etichetarea, înregistrarea sanitar-veterinară sau declarația pentru ambalaje.";

/** Reg. (UE) 1169/2011, anexa II — short labels for checkboxes (verified on EUR-Lex, 02.11.2026). */
export const ALLERGENS_1169_ANEXA_II = [
  { id: "gluten", label: "Cereale care conțin gluten" },
  { id: "crustacee", label: "Crustacee și produse derivate" },
  { id: "oua", label: "Ouă și produse derivate" },
  { id: "peste", label: "Pește și produse derivate" },
  { id: "arahide", label: "Arahide și produse derivate" },
  { id: "soia", label: "Soia și produse derivate" },
  { id: "lapte", label: "Lapte și produse derivate (inclusiv lactoză)" },
  { id: "nuci", label: "Fructe cu coajă lemnoasă" },
  { id: "telina", label: "Țelină și produse derivate" },
  { id: "mustar", label: "Muștar și produse derivate" },
  { id: "susan", label: "Semințe de susan și produse derivate" },
  { id: "sulfiti", label: "Dioxid de sulf și sulfiți (>10 mg/kg sau mg/l)" },
  { id: "lupin", label: "Lupin și produse derivate" },
  { id: "moluste", label: "Moluște și produse derivate" },
] as const;

export type AllergenId = (typeof ALLERGENS_1169_ANEXA_II)[number]["id"];

export const LEGAL_SOURCES = {
  lege608: {
    href: "https://legislatie.just.ro/Public/DetaliiDocument/70574",
    label: "Legea nr. 608/2001 privind evaluarea conformității produselor",
    summary:
      "art. 1: se aplică produselor din domeniile reglementate, prevăzute în anexa nr. 1; art. 2: acestea pot fi puse pe piață numai după evaluarea conformității și marcajului; art. 4 lit. h): „declarația de conformitate EC”; art. 12: conformitatea se atestă prin declarația EC și marcajul CE. Anexa nr. 1 (28 de domenii, inclusiv ambalaje la pct. 21) — fără alimente.",
  },
  codConsum: {
    href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/267003",
    label: "Legea nr. 296/2004 privind Codul consumului (text consolidat în vigoare)",
    summary:
      "Anexă pct. 16 — definiție: „declarație de conformitate - declarația făcută de către un producător sau un prestator, prin care acesta informează, pe propria răspundere, despre faptul că un produs sau un serviciu este conform cu un document tehnic normativ”. art. 52: obligația de informare a consumatorilor (inclusiv asupra produselor alimentare). art. 53: numai „produsele de folosință îndelungată” trebuie să fie însoțite de declarație, și numai „dacă reglementările în vigoare prevăd” — fără obligație pentru alimente.",
  },
  ordinAnsvsa: {
    href: "https://legislatie.just.ro/Public/DetaliiDocument/101005",
    label: "Ordin ANSVSA nr. 111/2008 (consolidat)",
    summary:
      "Înregistrarea activităților în domeniul alimentației (art. 1–2, în linie cu Reg. (CE) 852/2004 art. 6): înregistrarea unității, nu o declarație de conformitate pe produs.",
  },
  reg1169: {
    href: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj/ron",
    label: "Regulamentul (UE) nr. 1169/2011",
    summary:
      "art. 9 alin. (1): informații alimentare obligatorii (denumire, ingrediente, alergeni din anexa II, cantitate netă, data durabilității minimă / data limită de consum, condiții de depozitare, numele și adresa operatorului etc.).",
  },
  reg1935: {
    href: "https://eur-lex.europa.eu/eli/reg/2004/1935/oj/ron",
    label: "Regulamentul (CE) nr. 1935/2004",
    summary:
      "art. 16: materialele și obiectele destinate contactului cu alimentele trebuie însoțite de o declarație scrisă de conformitate (emisă de furnizorul ambalajului), cu documentația care o susține.",
  },
} as const;

export const SOURCES_ACCESSED = "02.11.2026";
