/** CUI of Ciocanel Razvan Tudor PFA (public, verified in the ANAF register). */
export const PFA_CUI = "33352046";

/** Legal operator name exactly as registered (no diacritics until confirmed). */
export const OPERATOR_LEGAL_NAME = "Ciocanel Razvan Tudor PFA";

/** Operator disclosure shown in the footer and on legal pages. */
export function operatorLineText(): string {
  return `Tapselo este un produs ${OPERATOR_LEGAL_NAME}, CUI ${PFA_CUI}`;
}
