// Canonical trailing-slash paths for tapselo.com internal links (Cloudflare Pages).

/** Root and in-page anchors are unchanged; external URLs pass through. */
export function internalPath(href: string): string {
  const raw = href.trim();
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const hashIdx = raw.indexOf("#");
  const pathPart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";

  if (!pathPart || pathPart === "/") return `/${hash}`;

  const withSlash = pathPart.endsWith("/") ? pathPart : `${pathPart}/`;
  return `${withSlash}${hash}`;
}
