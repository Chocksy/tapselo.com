/** TODO: Replace {{PFA_CUI}} with the real CUI before merge. */
export const PFA_CUI = "{{PFA_CUI}}";

/** Legal operator name exactly as registered (no diacritics until confirmed). */
export const OPERATOR_LEGAL_NAME = "Ciocanel Razvan Tudor PFA";

/** Operator disclosure shown in the footer and on legal pages. */
export function operatorLineText(): string {
  return `Tapselo este un produs ${OPERATOR_LEGAL_NAME}, CUI ${PFA_CUI}`;
}
