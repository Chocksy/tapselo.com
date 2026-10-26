// /llms.txt (llmstxt.org). Routes come from site-directory.ts, so a new tool or guide cannot ship
// without an entry here: buildLlmsTxt() throws on a missing or stale entry (same rule as /ai's LINES).
// Text here: dumneavoastră form, no prices or amounts, comma-below ș/ț (tests/llms-txt.test.ts).
import { articleLinks, datecsErrorPageLinks, guideHubLinks, ruleGuideLinks, shopGuideLinks, toolLinks, type SiteLink } from "../site-directory.ts";
import { internalPath } from "../internal-url.ts";

export const SITE = "https://tapselo.com";

type Entry = { title: string; desc: string };

const ENTRIES: Record<string, Entry> = {
  // Unelte
  "/unelte/": { title: "Unelte gratuite", desc: "Lista tuturor uneltelor gratuite pentru comercianți, care rulează în browser." },
  "/unelte/calculator-tva/": { title: "Calculator TVA", desc: "Calculează TVA-ul inclus sau adăugat, pe cotele în vigoare." },
  "/unelte/verificare-cod-de-bare/": { title: "Verificare cod de bare", desc: "Verifică cifra de control EAN și caută produsul după codul de bare." },
  "/unelte/verificare-cui/": { title: "Verificare CUI ANAF", desc: "Verifică o firmă după CUI în registrul public ANAF: TVA, TVA la încasare, e-Factura." },
  "/unelte/registru-de-casa/": { title: "Registru de casă", desc: "Completează și printează registrul de casă zilnic, cu soldul după fiecare înregistrare." },
  "/unelte/dispozitie-de-plata/": { title: "Dispoziție de plată", desc: "Generează dispoziția de plată sau încasare către casierie, gata de printat." },
  "/unelte/generator-nir/": { title: "Generator NIR", desc: "Întocmiți nota de intrare-recepție pentru marfa primită, cu TVA și adaos." },
  "/unelte/generator-aviz-de-insotire/": { title: "Aviz de însoțire a mărfii", desc: "Generează avizul de însoțire a mărfii, gata de printat." },
  "/unelte/fisa-de-magazie/": { title: "Fișă de magazie", desc: "Urmăriți intrările, ieșirile și stocul unui produs, document cu document." },
  "/unelte/generator-borderou-de-achizitie/": { title: "Borderou de achiziție", desc: "Generează borderoul de achiziție pentru produsele cumpărate de la persoane fizice." },
  "/unelte/calculator-adaos-comercial/": { title: "Calculator adaos comercial", desc: "De la cost la prețul de raft cu TVA și invers, cu rotunjire." },
  "/unelte/calculator-reducere/": { title: "Calculator reducere", desc: "Prețul după reducere, suma economisită și reduceri succesive." },
  "/unelte/generator-cod-de-bare/": { title: "Generator cod de bare", desc: "Generează coduri EAN-13, EAN-8 și Code 128, ca imagine sau pe foaie A4 cu etichete." },
  "/unelte/afise-obligatorii-magazin/": { title: "Afișe obligatorii magazin", desc: "Generează afișele obligatorii pentru magazin (casă de marcat, program, ANPC, SGR), ca PDF." },
  "/ghid/verificare-a4200/": { title: "Verificare A4200", desc: "Asistent în patru pași pentru declarația A4200: verificarea exportului, PDF-ul și depunerea la ANAF." },
  // Ghiduri: hub-uri
  "/ghid/": { title: "Ghid pentru magazine", desc: "Index cu regulile fiscale și pașii practici pentru magazinele mici din România, cu surse oficiale." },
  "/ghid/erori-datecs/": { title: "Erori casă de marcat Datecs", desc: "Codurile de eroare Datecs, în română și engleză, cu pași de rezolvare." },
  "/ghid/cantar-dibal/": { title: "Cântar Dibal", desc: "Codul de bare de pe eticheta cântarului, PLU și legătura cu casa de marcat." },
  "/ghid/articole/": { title: "Articole de suport", desc: "Ghiduri pas cu pas pentru casa de marcat și raportarea către ANAF." },
  // Ghiduri: erori Datecs (TAP-018)
  "/ghid/erori-datecs/lipsa-hartie/": { title: "Lipsă hârtie la casa de marcat Datecs (-100403)", desc: "Ce înseamnă eroarea și cum se schimbă rola, după manualele Datecs." },
  "/ghid/erori-datecs/capac-deschis/": { title: "Capac deschis la casa de marcat Datecs (-100404)", desc: "Ce înseamnă eroarea și ce faceți, după manualele Datecs." },
  "/ghid/erori-datecs/bon-deschis/": { title: "Bon deschis la casa de marcat Datecs (-111015)", desc: "Ce înseamnă eroarea și cum închideți bonul, după manualele Datecs." },
  // Ghiduri: reguli
  "/ghid/cote-tva-casa-de-marcat/": { title: "Cote TVA și grupe în casa de marcat", desc: "Cotele de TVA în vigoare și cum se programează grupele în casa de marcat." },
  "/ghid/plafon-scutire-tva-395000/": { title: "Plafonul de scutire de TVA", desc: "Plafonul de scutire de TVA pentru întreprinderile mici și când trebuie să vă înregistrați în scopuri de TVA." },
  "/ghid/microintreprindere-2026/": { title: "Microîntreprindere 2026", desc: "Plafonul de venituri și cota de impozit pentru microîntreprinderi în 2026." },
  "/ghid/plafoane-numerar/": { title: "Plafoane de numerar", desc: "Limitele pentru încasările și plățile în numerar și pentru soldul din casierie (Legea 70/2015)." },
  "/ghid/garantie-sgr-bon-fiscal/": { title: "Garanția SGR pe bonul fiscal", desc: "Cum apare garanția SGR la raft și pe bonul fiscal și înregistrarea la RetuRO." },
  "/ghid/raport-z-memorie-fiscala-p7b/": { title: "Raportul Z, memoria fiscală și fișierele .p7b", desc: "Raportul Z zilnic, transmiterea la ANAF și păstrarea fișierelor .p7b." },
  "/ghid/e-factura-b2b-b2c/": { title: "e-Factura B2B și B2C", desc: "Ce facturi se transmit în RO e-Factura, în ce termen, și când bonul fiscal este exceptat." },
  "/ghid/saf-t-d406-firme-mici/": { title: "SAF-T (D406) pentru firmele mici", desc: "Cine depune declarația D406, cât de des și până când." },
  "/ghid/pret-unitar-kg-litru/": { title: "Prețul unitar pe kg sau litru", desc: "Afișarea prețului pe unitatea de măsură la raft, inclusiv la vrac." },
  "/ghid/pret-redus-30-zile/": { title: "Reduceri: prețul anterior din ultimele 30 de zile", desc: "Ce preț tăiat puteți afișa la o reducere." },
  "/ghid/nir-nota-receptie/": { title: "NIR: nota de recepție", desc: "Când este obligatoriu NIR-ul și cum se tratează diferențele la recepție." },
  "/ghid/registrul-de-casa/": { title: "Registrul de casă", desc: "Cum se completează zilnic registrul de casă (14-4-7A)." },
  "/ghid/alergeni-1169-2011/": { title: "Alergeni la produse nepreambalate", desc: "Cum afișați informația despre cei 14 alergeni la produsele vândute nepreambalate." },
  "/ghid/e-transport/": { title: "RO e-Transport", desc: "Ce transporturi de bunuri cu risc fiscal ridicat se declară și cum se obține codul UIT." },
  "/ghid/registru-unic-de-control/": { title: "Registrul unic de control (RUC)", desc: "Cine trebuie să aibă registrul unic de control și unde se păstrează." },
  // Ghiduri: deschiderea unui magazin
  "/ghid/deschide-macelarie/": { title: "Deschiderea unei măcelării", desc: "Codul CAEN, înregistrarea DSVSA, acordul primăriei și casa de marcat." },
  "/ghid/deschide-brutarie-patiserie/": { title: "Deschiderea unei brutării sau patiserii", desc: "Codurile CAEN, DSVSA, acordul primăriei și casa de marcat." },
  "/ghid/deschide-cafenea-bistro/": { title: "Deschiderea unei cafenele sau a unui bistro", desc: "Codurile CAEN, DSVSA, autorizația de alimentație publică, casa de marcat și SGR." },
  "/ghid/deschide-minimarket-alimentara/": { title: "Deschiderea unui minimarket sau a unei alimentare", desc: "Codul CAEN, DSVSA, acordul primăriei, casa de marcat și punctul de returnare SGR." },
  "/ghid/deschide-legume-fructe/": { title: "Deschiderea unui magazin de legume și fructe", desc: "Codul CAEN, înregistrarea DSVSA, acordul primăriei și casa de marcat." },
  "/ghid/deschide-magazin-nealimentar/": { title: "Deschiderea unui magazin nealimentar", desc: "Codul CAEN potrivit, acordul primăriei, verificarea ISU și casa de marcat." },
  // Ghiduri: articole
  "/ghid/articole/depunere-a4200/": { title: "Depunerea declarației A4200 cu DUKIntegrator", desc: "Pașii pentru validarea și depunerea declarației A4200." },
  "/ghid/articole/erori-dukintegrator/": { title: "Erori DUKIntegrator la A4200", desc: "Erorile frecvente la validarea A4200 și cum le rezolvați." },
  "/ghid/articole/export-p7b-anaf/": { title: "Exportul fișierului .p7b pentru ANAF", desc: "Cum exportați din casa de marcat fișierele .p7b cerute de ANAF." },
  "/ghid/articole/raport-z-datecs-fp-70/": { title: "Raportul Z pe Datecs FP-70", desc: "Cum emiteți raportul Z pe casa de marcat Datecs FP-70." },
  "/ghid/articole/casa-de-marcat-fara-internet/": { title: "Casa de marcat fără internet", desc: "Bonuri offline, transmiterea către ANAF și formularul F4110." },
  // Comparații
  "/comparatie/": { title: "Comparație programe de casă de marcat", desc: "Tabel cu programele POS din România, după informațiile publice ale producătorilor." },
  "/comparatie/cel-mai-bun-program-casa-de-marcat/": { title: "Cel mai bun program de casă de marcat", desc: "Ce program se potrivește fiecărui tip de magazin." },
  "/comparatie/tapselo-vs-smartbill-pos/": {
    title: "Tapselo vs SmartBill POS",
    desc: "Comparație onestă pentru magazin alimentar mic: aceleași criterii, surse oficiale, prețuri publice.",
  },
  // Despre Tapselo
  "/": { title: "Tapselo", desc: "Prezentarea programului de casă de marcat Tapselo." },
  "/demo/": { title: "Demo", desc: "Încercați Tapselo în browser, fără cont." },
  "/program-gestiune-magazin/": { title: "Program gestiune magazin", desc: "Gestiunea stocurilor, recepția mărfii și vânzarea, în același program." },
  "/ai/": { title: "Tapselo în Claude și ChatGPT", desc: "Conectorul Tapselo pentru asistenții AI: reguli fiscale, calcule și documente printabile." },
};

const SUMMARY =
  "Tapselo este un program pentru casa de marcat, destinat magazinelor mici din România. Casa (programul de vânzare) rulează pe Windows, macOS și Linux; telefoanele se folosesc doar pentru gestiunea stocului. Pe tapselo.com găsiți și unelte gratuite, ghiduri cu reguli fiscale verificate și o comparație a programelor de casă de marcat.";

const hubs = (prefix: string) => guideHubLinks.filter((l) => l.href.startsWith(prefix));

/** Sections in display order; every href comes from site-directory.ts (or a fixed page path). */
export function llmsSections(): { heading: string; links: SiteLink[] }[] {
  const abs = (p: string): SiteLink => ({ href: internalPath(p), label: "" });
  return [
    { heading: "Unelte gratuite", links: [abs("/unelte"), ...toolLinks] },
    { heading: "Ghiduri", links: [...hubs("/ghid"), ...datecsErrorPageLinks, ...ruleGuideLinks, ...shopGuideLinks, ...articleLinks] },
    { heading: "Comparații", links: hubs("/comparatie") },
    { heading: "Despre Tapselo", links: ["/", "/demo", "/program-gestiune-magazin", "/ai"].map(abs) },
  ];
}

export function buildLlmsTxt(): string {
  const used = new Set<string>();
  const out = ["# Tapselo", "", `> ${SUMMARY}`, ""];
  for (const s of llmsSections()) {
    out.push(`## ${s.heading}`, "");
    for (const l of s.links) {
      const e = ENTRIES[l.href];
      if (!e) throw new Error(`/llms.txt: missing entry for ${l.href}`);
      if (used.has(l.href)) continue;
      used.add(l.href);
      out.push(`- [${e.title}](${SITE}${l.href}): ${e.desc}`);
    }
    out.push("");
  }
  const stale = Object.keys(ENTRIES).filter((k) => !used.has(k));
  if (stale.length) throw new Error(`/llms.txt: entries for unknown routes: ${stale.join(", ")}`);
  return out.join("\n");
}
