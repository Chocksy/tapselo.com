// Fisa tehnica (kind "recipe"): ingredients, cost per portion, allergens.
// Allergens = the 14 EU allergens (Reg. 1169/2011, annex II): the ones the user gave plus a
// Romanian keyword match on ingredient names. The sheet says the operator must confirm them.

import type { DraftRecord, RecipeIngredient, RecipePayload } from "./types.ts";
import { roundMoney } from "./validate.ts";
import { escapeHtml, fmtMoney, fmtQty, renderShell } from "./page.ts";

export const ALLERGENS = [
  { id: "gluten", name: "Cereale care contin gluten" },
  { id: "crustacee", name: "Crustacee" },
  { id: "oua", name: "Oua" },
  { id: "peste", name: "Peste" },
  { id: "arahide", name: "Arahide" },
  { id: "soia", name: "Soia" },
  { id: "lapte", name: "Lapte (inclusiv lactoza)" },
  { id: "fructe_coaja", name: "Fructe cu coaja lemnoasa" },
  { id: "telina", name: "Telina" },
  { id: "mustar", name: "Mustar" },
  { id: "susan", name: "Seminte de susan" },
  { id: "sulfiti", name: "Dioxid de sulf si sulfiti" },
  { id: "lupin", name: "Lupin" },
  { id: "moluste", name: "Moluste" },
] as const;

export type AllergenId = (typeof ALLERGENS)[number]["id"];

export const ALLERGEN_NOTE = "Alergenii trebuie confirmati de operator.";

// Words (no diacritics) -> allergen. Short words match whole tokens; longer ones match a token prefix.
const KEYWORDS: Record<AllergenId, string[]> = {
  gluten: ["gluten", "faina", "grau", "secara", "orz", "ovaz", "spelta", "kamut", "paine", "paste", "gris", "pesmet", "cuscus", "bulgur", "malt", "aluat", "biscuit", "tortilla", "crutoane", "foietaj", "taitei", "fidea", "spaghete", "macaroane"],
  crustacee: ["crustacee", "creveti", "crevete", "crab", "homar", "langustine", "raci", "rac"],
  oua: ["ou", "oua", "ouale", "galbenus", "galbenusuri", "albus", "albusuri", "maioneza", "ouo"],
  peste: ["peste", "pesti", "somon", "ton", "cod", "hering", "macrou", "sardine", "pastrav", "crap", "hamsii", "ansoa", "stavrid", "biban", "salau", "icre"],
  arahide: ["arahide", "arahida", "alune americane"],
  soia: ["soia", "tofu", "edamame", "tempeh", "miso"],
  lapte: ["lapte", "laptele", "unt", "smantana", "branz", "cascaval", "telemea", "iaurt", "frisca", "mozzarella", "parmezan", "mascarpone", "ricotta", "zer", "lactoza", "cas", "urda", "kefir", "sana", "lactate", "cheddar", "gorgonzola", "feta"],
  fructe_coaja: ["nuci", "nuca", "alune", "migdale", "migdala", "caju", "fistic", "pecan", "macadamia"],
  telina: ["telina", "telinei"],
  mustar: ["mustar", "mustarul"],
  susan: ["susan", "tahini"],
  sulfiti: ["sulfiti", "sulfit", "metabisulfit", "vin", "vinul", "otet de vin", "e220", "e221", "e222", "e223", "e224", "e228"],
  lupin: ["lupin", "lupini"],
  moluste: ["moluste", "midii", "scoici", "calamar", "calamari", "sepie", "caracatita", "stridii", "melci"],
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokens(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

function matches(text: string, kw: string): boolean {
  const k = norm(kw);
  if (k.includes(" ")) return ` ${tokens(text).join(" ")} `.includes(` ${k} `);
  return tokens(text).some((t) => (k.length >= 5 ? t.startsWith(k) : t === k));
}

/** Allergens found in a free text by the keyword map (also matches ids and the official names). */
export function allergensInText(text: string): AllergenId[] {
  const found: AllergenId[] = [];
  for (const a of ALLERGENS) {
    const words = [...KEYWORDS[a.id], a.id.replace("_", " "), a.name];
    if (words.some((w) => matches(text, w) || norm(text).trim() === norm(w))) found.push(a.id);
  }
  return found;
}

export interface IngredientAllergens {
  ids: AllergenId[];
  /** Given allergen words we could not map to one of the 14 (shown as given). */
  other: string[];
}

export function ingredientAllergens(g: Pick<RecipeIngredient, "name" | "allergens">): IngredientAllergens {
  const ids = new Set<AllergenId>(allergensInText(g.name));
  const other: string[] = [];
  for (const given of g.allergens ?? []) {
    const hit = allergensInText(given);
    if (hit.length) hit.forEach((h) => ids.add(h));
    else other.push(given);
  }
  return { ids: ALLERGENS.map((a) => a.id).filter((id) => ids.has(id)), other };
}

export interface RecipeCalc {
  lines: { cost: number | null; allergens: IngredientAllergens }[];
  total_cost: number;
  cost_per_portion: number;
  /** false when some ingredient has no cost */
  complete_cost: boolean;
  allergens: AllergenId[];
  other_allergens: string[];
}

export function recipeCalc(p: RecipePayload): RecipeCalc {
  let total = 0;
  let complete = true;
  const all = new Set<AllergenId>();
  const other = new Set<string>();
  const lines = p.ingredients.map((g) => {
    const cost = g.cost_per_unit !== undefined && g.cost_per_unit !== null ? roundMoney(g.quantity * g.cost_per_unit) : null;
    if (cost === null) complete = false;
    else total += cost;
    const al = ingredientAllergens(g);
    al.ids.forEach((x) => all.add(x));
    al.other.forEach((x) => other.add(x));
    return { cost, allergens: al };
  });
  const total_cost = roundMoney(total);
  return {
    lines,
    total_cost,
    cost_per_portion: roundMoney(total_cost / Math.max(1, p.portions)),
    complete_cost: complete,
    allergens: ALLERGENS.map((a) => a.id).filter((id) => all.has(id)),
    other_allergens: [...other],
  };
}

export const allergenName = (id: AllergenId): string => ALLERGENS.find((a) => a.id === id)?.name ?? id;

const CSS = `
.allergens{margin:4mm 0 0;padding:3mm 4mm;border:1.5px solid #000}
.allergens h2{margin:0 0 1.5mm;font-size:11pt}
.allergens ul{margin:0;padding-left:5mm;columns:2;font-size:9.5pt}
.allergens .confirm{margin:2mm 0 0;font-weight:700;font-size:9.5pt}
.cost-box{display:flex;gap:8mm;margin:4mm 0 0;font-size:10.5pt}
.cost-box b{font-size:12pt}
`;

export function renderRecipe(p: RecipePayload, draft: DraftRecord): string {
  const c = recipeCalc(p);
  const rows = p.ingredients
    .map((g, i) => {
      const l = c.lines[i];
      const al = [...l.allergens.ids.map(allergenName), ...l.allergens.other].join(", ");
      return `<tr>
<td class="ctr">${i + 1}</td>
<td>${escapeHtml(g.name)}</td>
<td class="num">${escapeHtml(fmtQty(g.quantity))}</td>
<td class="ctr">${escapeHtml(g.unit)}</td>
<td class="num">${g.cost_per_unit === undefined ? "—" : escapeHtml(fmtQty(g.cost_per_unit, 4))}</td>
<td class="num">${l.cost === null ? "—" : escapeHtml(fmtMoney(l.cost))}</td>
<td>${escapeHtml(al)}</td>
</tr>`;
    })
    .join("\n");
  const list = [...c.allergens.map(allergenName), ...c.other_allergens];
  const body = `<h1 class="doc-title">Fisa tehnica</h1>
<div class="doc-meta">
<span><b>Produs:</b> ${escapeHtml(p.name)}</span>
<span><b>Numar de portii:</b> ${escapeHtml(String(p.portions))}</span>
</div>
<table class="doc">
<thead><tr><th>Nr.</th><th>Ingredient</th><th>Cantitate</th><th>UM</th><th>Cost / UM (lei)</th><th>Cost (lei)</th><th>Alergeni</th></tr></thead>
<tbody>
${rows}
</tbody>
<tfoot><tr><td colspan="5">Cost total ingrediente</td><td class="num">${fmtMoney(c.total_cost)}</td><td></td></tr></tfoot>
</table>
<div class="cost-box">
<span>Cost total: <b>${fmtMoney(c.total_cost)} lei</b></span>
<span>Cost pe portie: <b>${fmtMoney(c.cost_per_portion)} lei</b></span>
</div>
${c.complete_cost ? "" : `<p class="note muted">Unele ingrediente nu au cost; costul este partial.</p>`}
<section class="allergens">
<h2>Alergeni (Reg. UE 1169/2011)</h2>
${list.length ? `<ul>${list.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : `<p>Nu am gasit alergeni in lista de ingrediente.</p>`}
<p class="confirm">${ALLERGEN_NOTE}</p>
</section>
<div class="signs">
<div>Intocmit<span>Nume, prenume, semnatura</span></div>
<div>Aprobat<span>Nume, prenume, semnatura</span></div>
</div>`;
  return renderShell({ kind: "recipe", title: `Fisa tehnica ${p.name}`, expiresAt: draft.expires_at, body, css: CSS });
}

export function recipeSummary(p: RecipePayload): string {
  const c = recipeCalc(p);
  const al = [...c.allergens.map(allergenName), ...c.other_allergens];
  return [
    `Fisa tehnica "${p.name}": ${p.ingredients.length} ingrediente, ${p.portions} portii.`,
    `Cost total ${fmtMoney(c.total_cost)} lei, cost pe portie ${fmtMoney(c.cost_per_portion)} lei${c.complete_cost ? "" : " (partial: unele ingrediente nu au cost)"}.`,
    `Alergeni: ${al.length ? al.join(", ") : "niciunul gasit"}. ${ALLERGEN_NOTE}`,
  ].join("\n");
}
