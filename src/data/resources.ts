// Every free tool and guide page, for the menu Resurse panel, the H2 sub-bar search and the /ghid/ group anchors.
// Titles are short labels for lists (not the <title> tags). Add a page here when you add it under /ghid/ or /unelte/.

export type ResourceType = "u" | "g" | "a" | "c" | "p";
export type GuideGroup = "datecs" | "taxe" | "deschidere" | "acte" | "preturi";

export interface Resource {
  title: string;
  href: string;
  type: ResourceType;
  group?: GuideGroup;
  /** Extra search words (no diacritics needed). */
  keys?: string;
  /** Most used: blue dot in the menu, shown first in empty search. */
  hot?: boolean;
}

export const TYPE_LABEL: Record<ResourceType, string> = { u: "Unealtă", g: "Ghid", a: "Articol", c: "Comparație", p: "Pagină" };

export const tools: Resource[] = [
  ["Calculator reducere", "/unelte/calculator-reducere/", "discount procent promotie"],
  ["Dispoziție de plată", "/unelte/dispozitie-de-plata/", "incasare plata numerar"],
  ["Verificare cod de bare", "/unelte/verificare-cod-de-bare/", "ean gtin cantar"],
  ["Afișe obligatorii magazin", "/unelte/afise-obligatorii-magazin/", "orar anpc fumatul"],
  ["Calculator TVA", "/unelte/calculator-tva/", "tva 21 11 cota"],
  ["Generator NIR", "/unelte/generator-nir/", "nota receptie"],
  ["Verificare CUI ANAF", "/unelte/verificare-cui/", "firma cif"],
  ["Registru de casă", "/unelte/registru-de-casa/", "numerar"],
  ["Aviz de însoțire", "/unelte/generator-aviz-de-insotire/", "marfa transport"],
  ["Fișă de magazie", "/unelte/fisa-de-magazie/", "stoc"],
  ["Borderou de achiziție", "/unelte/generator-borderou-de-achizitie/", "achizitie persoane fizice"],
  ["Calculator adaos comercial", "/unelte/calculator-adaos-comercial/", "tva marja pret raft"],
  ["Generator cod de bare", "/unelte/generator-cod-de-bare/", "ean etichete"],
  ["Declarație de conformitate", "/unelte/declaratie-de-conformitate-produse-alimentare/", "alimente"],
  ["Proces-verbal anulare bon", "/unelte/proces-verbal-anulare-bon-fiscal/", "bon fiscal anulat"],
  ["Verificare A4200", "/ghid/verificare-a4200/", "declaratie a4200 export"],
].map(([title, href, keys], i) => ({ title, href, keys, type: "u" as const, hot: i < 6 }));

const g = (group: GuideGroup, type: ResourceType, title: string, href: string, keys = "", hot = false): Resource => ({ title, href, type, group, keys, hot });

export const guides: Resource[] = [
  g("datecs", "g", "Erori casă de marcat Datecs", "/ghid/erori-datecs/", "cod eroare fp-700", true),
  g("datecs", "g", "Lipsă hârtie (-100403)", "/ghid/erori-datecs/lipsa-hartie/", "rola"),
  g("datecs", "g", "Capac deschis (-100404)", "/ghid/erori-datecs/capac-deschis/"),
  g("datecs", "g", "Bon deja deschis", "/ghid/erori-datecs/bon-deschis/", "-111015"),
  g("datecs", "g", "Raportul Z, memoria fiscală și fișierele .p7b", "/ghid/raport-z-memorie-fiscala-p7b/", "raport z"),
  g("datecs", "g", "TVA 21% și 11%: grupe în casa de marcat", "/ghid/cote-tva-casa-de-marcat/", "cote tva"),
  g("datecs", "g", "Cântar Dibal", "/ghid/cantar-dibal/", "cantar eticheta"),
  g("datecs", "g", "SGR 0,50 lei: bon fiscal și RetuRO", "/ghid/garantie-sgr-bon-fiscal/", "garantie ambalaj"),
  g("datecs", "a", "Casa de marcat fără internet", "/ghid/articole/casa-de-marcat-fara-internet/", "offline", true),
  g("datecs", "a", "Cod QR pe bonul fiscal", "/ghid/articole/cod-qr-bon-fiscal/", "", true),
  g("datecs", "a", "Cum scoți raportul Z pe Datecs FP-70", "/ghid/articole/raport-z-datecs-fp-70/", "", true),
  g("datecs", "a", "Cum exporți fișierul .p7b pentru ANAF", "/ghid/articole/export-p7b-anaf/", "raport z"),
  g("taxe", "g", "Plafonul de scutire de TVA: 395.000 lei", "/ghid/plafon-scutire-tva-395000/", "tva"),
  g("taxe", "g", "Microîntreprindere 2026: plafon și impozit 1%", "/ghid/microintreprindere-2026/", "micro"),
  g("taxe", "g", "Plafoane numerar: 5.000 lei/zi, 50.000 casă", "/ghid/plafoane-numerar/", "cash"),
  g("taxe", "g", "e-Factura: facturi B2B și B2C", "/ghid/e-factura-b2b-b2c/", "efactura"),
  g("taxe", "g", "RO e-Transport: bunuri cu risc fiscal", "/ghid/e-transport/", "etransport"),
  g("taxe", "g", "SAF-T (D406) pentru firmele mici", "/ghid/saf-t-d406-firme-mici/", "saft"),
  g("taxe", "g", "Certificat de atestare fiscală", "/ghid/certificat-de-atestare-fiscala/", "anaf"),
  g("taxe", "g", "Declarare punct de lucru la ANAF", "/ghid/declarare-punct-de-lucru-anaf/", "sediu secundar 060 061", true),
  g("taxe", "a", "Cum depui declarația A4200", "/ghid/articole/depunere-a4200/"),
  g("taxe", "a", "Erori DUKIntegrator la A4200", "/ghid/articole/erori-dukintegrator/"),
  g("deschidere", "g", "Minimarket sau alimentară: deschidere", "/ghid/deschide-minimarket-alimentara/", "magazin alimentar autorizatii"),
  g("deschidere", "g", "Brutărie sau patiserie: deschidere", "/ghid/deschide-brutarie-patiserie/", "autorizatii"),
  g("deschidere", "g", "Cafenea sau bistro: deschidere", "/ghid/deschide-cafenea-bistro/", "autorizatii"),
  g("deschidere", "g", "Magazin legume și fructe: deschidere", "/ghid/deschide-legume-fructe/", "autorizatii"),
  g("deschidere", "g", "Cum deschizi o măcelărie", "/ghid/deschide-macelarie/", "autorizatii"),
  g("deschidere", "g", "Magazin nealimentar: deschidere", "/ghid/deschide-magazin-nealimentar/", "autorizatii"),
  g("acte", "g", "NIR: notă de recepție și diferențe", "/ghid/nir-nota-receptie/", "receptie"),
  g("acte", "g", "Registrul de casă", "/ghid/registrul-de-casa/", "numerar"),
  g("acte", "g", "Registrul unic de control (RUC)", "/ghid/registru-unic-de-control/", "ruc"),
  g("preturi", "g", "Reduceri: prețul anterior, 30 zile", "/ghid/pret-redus-30-zile/", "reducere promotie"),
  g("preturi", "g", "Prețul unitar pe kg sau litru la raft", "/ghid/pret-unitar-kg-litru/", "eticheta"),
  g("preturi", "g", "Alergeni la produse nepreambalate", "/ghid/alergeni-1169-2011/", "1169"),
];

export const pages: Resource[] = [
  { title: "Tot ghidul", href: "/ghid/", type: "p" },
  { title: "Articole de suport", href: "/ghid/articole/", type: "p" },
  { title: "Toate uneltele gratuite", href: "/unelte/", type: "p" },
  { title: "Comparație programe POS", href: "/comparatie/", type: "c", keys: "smartbill" },
  { title: "Cel mai bun program de casă de marcat", href: "/comparatie/cel-mai-bun-program-casa-de-marcat/", type: "c" },
  { title: "Tapselo vs SmartBill POS", href: "/comparatie/tapselo-vs-smartbill-pos/", type: "c" },
  { title: "Asistent AI: Tapselo în Claude și ChatGPT", href: "/ai/", type: "p", keys: "chatgpt claude" },
  { title: "Program gestiune magazin", href: "/program-gestiune-magazin/", type: "p", keys: "stoc" },
];

export const allResources: Resource[] = [...tools, ...guides, ...pages];

export const GUIDE_GROUPS: { id: GuideGroup; label: string; blurb: string }[] = [
  { id: "datecs", label: "Casa de marcat Datecs", blurb: "Erori Datecs, raport Z, cod QR" },
  { id: "taxe", label: "Taxe și ANAF", blurb: "Plafon TVA, micro 2026, e-Factura" },
  { id: "deschidere", label: "Deschizi magazinul", blurb: "Alimentară, brutărie, cafenea" },
  { id: "acte", label: "Acte și registre", blurb: "NIR, registrul de casă, RUC" },
  { id: "preturi", label: "Prețuri și etichete", blurb: "Preț redus, preț pe kg, alergeni" },
];

export const groupCount = (id: GuideGroup) => guides.filter((r) => r.group === id).length;

/** Sub-bar links. The current one is picked by `currentSubnav`. */
export const SUBNAV = [
  { id: "unelte", label: "Unelte gratuite", href: "/unelte/", count: tools.length },
  { id: "ghid", label: "Ghiduri", href: "/ghid/", count: guides.length },
  { id: "datecs", label: "Casa de marcat Datecs", href: "/ghid/#datecs" },
  { id: "taxe", label: "Taxe și ANAF", href: "/ghid/#taxe" },
  { id: "comparatie", label: "Comparație", href: "/comparatie/" },
  { id: "ai", label: "Asistent AI", href: "/ai/" },
] as const;

const slash = (p: string) => (p.endsWith("/") ? p : p + "/");

/** Which sub-bar link is current for a path; null when the page gets no sub-bar. */
export function currentSubnav(pathname: string): (typeof SUBNAV)[number]["id"] | null {
  const p = slash(pathname);
  if (p.startsWith("/unelte/")) return "unelte";
  if (p.startsWith("/comparatie/")) return "comparatie";
  if (p === "/ai/") return "ai";
  if (!p.startsWith("/ghid/")) return null;
  const r = allResources.find((x) => x.href === p);
  if (r?.type === "u") return "unelte";
  if (r?.group === "datecs" || p.startsWith("/ghid/erori-datecs/")) return "datecs";
  if (r?.group === "taxe") return "taxe";
  return "ghid";
}

export function findResource(pathname: string): Resource | undefined {
  const p = slash(pathname);
  return allResources.find((x) => x.href === p);
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const TYPE_RANK: Record<ResourceType, number> = { u: 0, g: 0.1, a: 0.2, c: 0.3, p: 0.4 };

/** Search titles and keys, diacritics ignored. Empty query: the most used pages. `at` is the title match index (-1: matched a key). */
export function searchResources(q: string): { r: Resource; at: number }[] {
  const n = norm(q.trim());
  if (!n) return allResources.filter((r) => r.hot).slice(0, 6).map((r) => ({ r, at: -1 }));
  return allResources
    .map((r) => {
      const at = norm(r.title).indexOf(n);
      if (at < 0 && !norm(r.keys ?? "").includes(n)) return null;
      return { r, at, s: (at === 0 ? 0 : at > 0 ? 1 : 2) - (r.hot ? 0.5 : 0) + TYPE_RANK[r.type] };
    })
    .filter((x): x is { r: Resource; at: number; s: number } => !!x)
    .sort((a, b) => a.s - b.s)
    .map(({ r, at }) => ({ r, at }));
}
