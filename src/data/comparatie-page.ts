// /comparatie/: byline, dates and FAQ in one place.

/**
 * Author byline for /comparatie/.
 *
 * TODO(TAP-BESTOF-GAP-53): replace the placeholders with the real name, role, photo and LinkedIn URL
 * once Razvan confirms them, then set `isPlaceholder: false`. While `isPlaceholder` is true the page
 * shows the placeholders (clearly marked) and does NOT emit an `author` / Person in the JSON-LD.
 */
export const COMPARATIE_AUTHOR = {
  isPlaceholder: true,
  /** Full name, e.g. "Prenume Nume". */
  name: "[NUME AUTOR — de completat]",
  /** Short role shown after the name. */
  role: "[ROL — de completat]",
  /** Path under /public (e.g. "/authors/nume.jpg"), or null to show the initials circle. */
  photo: null as string | null,
  /** Full https://www.linkedin.com/in/... URL, or null to hide the link. */
  linkedin: null as string | null,
};

/** First publish of /comparatie/ (first git commit of src/pages/comparatie.astro, 58c32d4). */
export const COMPARATIE_PUBLISHED_ON = "2026-10-01";
/** Last content revision. Bump when the page copy or criteria change. */
export const COMPARATIE_UPDATED_ON = "2026-10-17";

/** Visible FAQ and FAQPage JSON-LD use the same plain text. */
export const COMPARATIE_FAQ: { q: string; a: string }[] = [
  {
    q: "Care este cel mai bun program de casă de marcat pentru un magazin mic?",
    a: "Depinde de ce vinzi. Dacă ai produse la kilogram, rețete sau vrei să vinzi și fără internet, uită-te în tabel la rândurile Offline, Cântare și Rețete. Tapselo le are pe toate trei și este gratuit cât timp e în beta, apoi costă 79 sau 129 lei/lună + TVA.",
  },
  {
    q: "Pot vinde fără internet?",
    a: "Da, cu programele care au bifă verde pe rândul Offline din tabel. Tapselo păstrează vânzările local și le sincronizează automat când revine conexiunea.",
  },
  {
    q: "Ce diferență e între SmartBill, Oblio și Tapselo?",
    a: "SmartBill POS este o aplicație POS pentru Android și Windows, iar stocul se descarcă prin SmartBill Gestiune (pachetul POS + Gestiune costă 27,22 €/lună + TVA, conform site-ului SmartBill). La Oblio produsul principal este facturarea, iar interfața POS este o funcție a modulului Stocuri. Tapselo pornește de la casa de marcat din magazinul alimentar mic: vânzare offline, cântar, rețete și stocuri. Detaliile și sursele sunt în tabel și la fiecare producător.",
  },
  {
    q: "Pe ce calculatoare rulează Tapselo?",
    a: "Aplicația de casă Tapselo rulează pe calculatoare cu Windows, macOS și Linux. Pe telefon folosești aplicația de inventar.",
  },
  {
    q: "Cât costă Tapselo?",
    a: "Cât timp e în beta, Tapselo este gratuit, fără card. După beta costă 79 lei/lună + TVA (planul Start, o casă de marcat) sau 129 lei/lună + TVA (planul Magazin, două case), cu preaviz de 30 de zile înainte de tarif.",
  },
];
