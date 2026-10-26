// „Retrage acordul” (art. 7 alin. (3) GDPR). Loaded on every page via the footer, so it must not pull
// Meta code onto pages other than /demo/ (tests/meta-pixel-scope.test.ts). The Meta-side steps
// (fbq consent revoke) run in MetaPixelDemo on the WITHDRAW_EVENT.
import { CONSENT_KEY, LANDING_KEY, consentCookies } from "./meta/pixel.ts";

export const WITHDRAW_EVENT = "tapselo:consent-withdrawn";

/**
 * tapselo_consent=denied on .tapselo.com (kept, not deleted, so the demo apps see the denial),
 * tapselo_attr deleted, localStorage choice = denied, first-page-of-visit (sessionStorage) dropped. Returns the cookies written.
 */
export function withdrawConsent(env: {
  setCookie: (c: string) => void;
  local?: Pick<Storage, "setItem"> | null;
  session?: Pick<Storage, "removeItem"> | null;
}): string[] {
  const cookies = consentCookies("denied");
  for (const c of cookies) env.setCookie(c);
  // On every page and with or without a pixel ID: the stored choice becomes „Refuz”, so the pixel
  // never comes back without a prompt once the denied cookie expires.
  try {
    env.local?.setItem(CONSENT_KEY, "denied");
  } catch {
    /* storage blocked */
  }
  try {
    env.session?.removeItem(LANDING_KEY);
  } catch {
    /* storage blocked */
  }
  return cookies;
}

/** True when the .tapselo.com consent cookie says denied (overrides an older local „Accept”). */
export function cookieDenied(cookieHeader: string): boolean {
  return cookieHeader.split(/;\s*/).includes("tapselo_consent=denied");
}
