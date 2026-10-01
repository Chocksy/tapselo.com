// One entry point for /g/{id}: draft record -> HTML + cache time.
// The stored payload runs through the same validators as the tools; a draft that fails
// them (written around the tools) renders the not-found page.

import type { DraftKind, DraftRecord } from "./types.ts";
import { isDraftKind, validatePayload } from "./validate.ts";
import { renderGeneratedNotFound } from "./page.ts";
import { renderFlyer } from "./flyer.ts";
import { renderLabels } from "./labels.ts";
import { renderNir } from "./nir.ts";
import { renderRecipe } from "./recipe.ts";
import { renderCashbook } from "./cashbook.ts";

export const ID_RE = /^[A-Za-z0-9]{10}$/;

export interface Rendered {
  html: string;
  status: 200 | 404;
  /** Cache-Control max-age in seconds. */
  maxAge: number;
}

export function renderDraft(draft: DraftRecord | null | undefined, id: string): Rendered {
  const notFound: Rendered = { html: renderGeneratedNotFound(), status: 404, maxAge: 60 };
  if (!draft || typeof draft !== "object" || !isDraftKind(draft.kind) || !ID_RE.test(id)) return notFound;
  const kind: DraftKind = draft.kind;
  let html = "";
  try {
    switch (kind) {
      case "flyer":
        html = renderFlyer(validatePayload("flyer", draft.payload), draft, id);
        break;
      case "labels":
        html = renderLabels(validatePayload("labels", draft.payload), draft);
        break;
      case "nir":
        html = renderNir(validatePayload("nir", draft.payload), draft);
        break;
      case "recipe":
        html = renderRecipe(validatePayload("recipe", draft.payload), draft);
        break;
      case "cashbook":
        html = renderCashbook(validatePayload("cashbook", draft.payload), draft);
        break;
    }
  } catch (e) {
    console.warn("g render failed", kind, e instanceof Error ? e.name : "error");
    return notFound;
  }
  return { html, status: 200, maxAge: 600 };
}
