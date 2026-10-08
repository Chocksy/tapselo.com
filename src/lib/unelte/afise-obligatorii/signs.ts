import { escapeHtml } from "../../generators/page.ts";
import { ANPC_COMPLAINT_URL, ANPC_SAL_PHONE, ANPC_SAL_URL } from "./anpc-counties.ts";
import { formatScheduleLines, shopHeaderLines } from "./schedule.ts";
import type { RenderedSign, SignId, ToolState } from "./types.ts";

/**
 * Text aliniat modelului din anexa la Ordinul MF nr. 159/2015 (MO nr. 131/2015; anexa este publicată în facsimil pe legislatie.just.ro).
 */
export const CASA_MARCAT_MAIN =
  "Această unitate este dotată cu casă de marcat fiscală conform Legii nr. 116/2004 și O.U.G. nr. 28/1999. Vă rugăm solicitați și păstrați bonul fiscal!";

/** Optional lines from the same annex (OUG 28/1999, art. 1 alin. (9)–(10¹)). */
export const CASA_MARCAT_EXTENDED: string[] = [
  "Dacă nu primiți bonul fiscal, aveți obligația să-l solicitați.",
  "În cazul unui refuz, aveți dreptul de a beneficia de bunul achiziționat sau de serviciul prestat fără plata contravalorii acestuia.",
];

const FUMAT_TITLE = "Fumatul interzis";

const MINORI_TITLE = "Interzisă vânzarea către persoane sub 18 ani";

const MINORI_BODY_TUTUN =
  "Interzisă vânzarea produselor din tutun, țigaretelor electronice și produselor conexe către persoane care nu au împlinit vârsta de 18 ani.";

const MINORI_FOOTNOTE_ALCOOL =
  "Băuturi alcoolice: interzisă comercializarea sau oferirea cu titlu gratuit către minori (Legea nr. 61/1991, art. 2 pct. 23^1, introdus prin Legea nr. 174/2023).";

const MINORI_FOOTNOTE_TUTUN =
  "Tutun și produse conexe: obligație de afișare a interdicției la locul de vânzare (Ordinul ANPC nr. 331/2025, art. 1–2).";

function p(lines: string[]): string {
  return lines.map((l) => `<p class="sign-p">${escapeHtml(l)}</p>`).join("");
}

function renderCasaMarcat(state: ToolState): RenderedSign {
  const extra = state.casaMarcatExtended ? CASA_MARCAT_EXTENDED : [];
  return {
    id: "casa_marcat",
    title: "Casă de marcat",
    landscape: false,
    bodyHtml: `<div class="sign-box sign-emphasis">
<h2 class="sign-h">${escapeHtml(CASA_MARCAT_MAIN)}</h2>
${p(extra)}
</div>`,
  };
}

function renderProgram(state: ToolState): RenderedSign {
  const header = shopHeaderLines(state.shop);
  const lines = formatScheduleLines(state.schedule);
  return {
    id: "program",
    title: "Program de funcționare",
    landscape: false,
    bodyHtml: `<div class="sign-box">
<h2 class="sign-h">Program de funcționare</h2>
${header.length ? `<div class="sign-meta">${p(header)}</div>` : ""}
${p(lines)}
</div>`,
  };
}

function renderAnpc(state: ToolState): RenderedSign {
  const a = state.anpc;
  const lines = [
    a.commissionName.trim(),
    a.address.trim(),
    a.phone.trim() ? `Tel.: ${a.phone.trim()}` : "",
    a.email.trim() ? `E-mail: ${a.email.trim()}` : "",
    "",
    "Autoritatea Națională pentru Protecția Consumatorilor",
    `Telefonul consumatorului (SAL): ${ANPC_SAL_PHONE}`,
    `Soluționare alternativă a litigiilor (SAL): ${ANPC_SAL_URL}`,
    `Reclamații online: ${ANPC_COMPLAINT_URL}`,
  ].filter(Boolean);
  return {
    id: "anpc",
    title: "Informații consumatori (ANPC)",
    landscape: true,
    bodyHtml: `<div class="sign-box sign-anpc">
<h2 class="sign-h">Informații pentru consumatori</h2>
${p(lines)}
</div>`,
  };
}

function renderSgr(state: ToolState): RenderedSign {
  const lines: string[] = [];
  if (state.sgrHasReturnPoint && state.sgrAcceptsReturns) {
    lines.push(
      "Acest punct de vânzare preia ambalaje SGR returnate de consumatori și restituie garanția, conform HG nr. 1074/2021.",
    );
    const addr = state.sgrReturnAddress.trim();
    const hours = state.sgrReturnHours.trim();
    if (addr) lines.push(`Punct de returnare: ${addr}`);
    if (hours) lines.push(`Program returnare: ${hours}`);
    lines.push(
      "Ambalajele SGR pot fi returnate în orice punct de returnare din România; valoarea garanției (0,5 lei per ambalaj) se indică distinct de preț (HG nr. 1074/2021, art. 6 alin. (1) lit. b) și art. 12 alin. (5)).",
    );
  } else {
    lines.push(
      "Informații pentru consumatori privind garanția-returnare (HG nr. 1074/2021, art. 6 alin. (1) lit. g)): ambalajele SGR pot fi returnate în orice punct de returnare din România.",
      "Dacă returnarea se face prin parteneriat UAT/ADI fără punct propriu în magazin, se afișează textul: „Acest magazin nu funcționează ca punct de returnare a ambalajelor“ (art. 6 alin. (2)).",
    );
  }
  return {
    id: "sgr",
    title: "SGR – garanție-returnare",
    landscape: false,
    bodyHtml: `<div class="sign-box">
<h2 class="sign-h">Sistemul de garanție-returnare (SGR)</h2>
${p(lines)}
</div>`,
  };
}

function renderFumat(): RenderedSign {
  return {
    id: "fumat",
    title: FUMAT_TITLE,
    landscape: false,
    bodyHtml: `<div class="sign-box sign-center">
<p class="sign-symbol" aria-hidden="true">🚭</p>
<h2 class="sign-h sign-lg">${escapeHtml(FUMAT_TITLE)}</h2>
<p class="sign-p muted">Spații publice închise — Legea nr. 349/2002, art. 3 alin. (1) și art. 5 alin. (1).</p>
</div>`,
  };
}

function renderMinori(): RenderedSign {
  return {
    id: "minori_alcool_tutun",
    title: MINORI_TITLE,
    landscape: false,
    bodyHtml: `<div class="sign-box sign-center">
<h2 class="sign-h sign-lg">${escapeHtml(MINORI_TITLE)}</h2>
<p class="sign-p">${escapeHtml(MINORI_BODY_TUTUN)}</p>
<p class="sign-p muted">${escapeHtml(MINORI_FOOTNOTE_ALCOOL)}</p>
<p class="sign-p muted">${escapeHtml(MINORI_FOOTNOTE_TUTUN)}</p>
</div>`,
  };
}

const BUILDERS: Record<SignId, (s: ToolState) => RenderedSign> = {
  casa_marcat: renderCasaMarcat,
  program: renderProgram,
  anpc: renderAnpc,
  sgr: renderSgr,
  fumat: () => renderFumat(),
  minori_alcool_tutun: () => renderMinori(),
};

export function buildSigns(state: ToolState): RenderedSign[] {
  const out: RenderedSign[] = [];
  for (const id of state.selected) {
    const fn = BUILDERS[id];
    if (fn) out.push(fn(state));
  }
  return out;
}

export function defaultToolState(): ToolState {
  return {
    selected: ["casa_marcat", "program", "anpc"],
    shop: { businessName: "", cui: "", address: "", logoDataUrl: null },
    schedule: {
      mon: { open: "08:00", close: "20:00" },
      tue: { open: "08:00", close: "20:00" },
      wed: { open: "08:00", close: "20:00" },
      thu: { open: "08:00", close: "20:00" },
      fri: { open: "08:00", close: "20:00" },
      sat: { open: "09:00", close: "14:00" },
      sun: null,
      breakLabel: "",
      closedNotes: "",
    },
    anpc: {
      countyId: "bucuresti",
      commissionName: "",
      address: "",
      phone: "",
      email: "",
    },
    casaMarcatExtended: false,
    sgrAcceptsReturns: true,
    sgrReturnAddress: "",
    sgrReturnHours: "",
    sgrHasReturnPoint: true,
  };
}
