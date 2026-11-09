// Inner SVG markup for the app icons used on the phone page (copied from the G2 mockup, which copies the app).
export const PI: Record<string, string> = {
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h8"/>',
  nfc: '<path d="M6 8.3a6 6 0 0 1 0 7.4M9.5 6a10 10 0 0 1 0 12M13 4a14 14 0 0 1 0 16M16.5 2.5a17 17 0 0 1 0 19"/>',
  tick: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
export const svg = (k: string, w = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PI[k]}</svg>`;
// Payment method tiles: [icon, background, color, title, subtitle]
export const PAY: [string, string, string, string, string][] = [
  ["cash", "#d1fae5", "#065f46", "Numerar exact", "Clientul da fix 19.90 RON"],
  ["calc", "#ecfdf5", "#047857", "Numerar cu rest", "Calculez restul"],
  ["nfc", "#dbeafe", "#1d4ed8", "Card pe telefon", "Clientul apropie cardul"],
  ["tick", "#fef3c7", "#92400e", "Tichete", "Tichete de masa, plata mixta"],
];
