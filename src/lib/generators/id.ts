/** Document ids: `public_tool_new_id()` in Chocksy/pos (10 chars from [A-Za-z0-9]). */
export const PUBLIC_TOOL_ID_LENGTH = 10;
export const PUBLIC_TOOL_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const PUBLIC_TOOL_ID_PATTERN = "^[A-Za-z0-9]{10}$";

/** Shannon entropy per character: log2(62) for a uniform base62 alphabet. */
export const PUBLIC_TOOL_ID_ENTROPY_BITS = Math.round(
  PUBLIC_TOOL_ID_LENGTH * (Math.log2(PUBLIC_TOOL_ID_ALPHABET.length) * 100),
) / 100;

export const PUBLIC_TOOL_ID_FORMAT =
  `${PUBLIC_TOOL_ID_LENGTH} caractere base62 (A–Z, a–z, 0–9), ~${PUBLIC_TOOL_ID_ENTROPY_BITS} biți de entropie (~${PUBLIC_TOOL_ID_ALPHABET.length}^${PUBLIC_TOOL_ID_LENGTH} combinații).`;
