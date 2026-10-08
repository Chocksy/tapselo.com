// Tiny markdown to HTML for the KB bodies on /ghid pages.
// Supports paragraphs, **bold**, `code`, "- " and "1. " lists, [text](url) links.
// Everything else is escaped. Links only for https:, http: and site paths.

import { escapeHtml } from "./offers-render.ts";
import { internalPath } from "./internal-url.ts";

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(u) || /^\/[^\s"'<>]*$/.test(u) || /^#[\w-]+$/.test(u)) return u;
  return null;
}

/** Inline markdown on one line of raw text; returns HTML. */
export function inlineMd(raw: string): string {
  const out: string[] = [];
  // Split into code spans, links and plain text, so escaping happens once per piece.
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    out.push(bold(escapeHtml(raw.slice(last, m.index))));
    if (m[1] !== undefined) {
      out.push(`<code>${escapeHtml(m[1])}</code>`);
    } else {
      const rawHref = safeHref(m[3]);
      const href = rawHref && rawHref.startsWith("/") ? internalPath(rawHref) : rawHref;
      const text = bold(escapeHtml(m[2]));
      const ext = href && /^https?:/i.test(href);
      out.push(
        href
          ? `<a href="${escapeHtml(href)}"${ext ? ' rel="noopener" target="_blank"' : ""}>${text}</a>`
          : text,
      );
    }
    last = re.lastIndex;
  }
  out.push(bold(escapeHtml(raw.slice(last))));
  return out.join("");
}

// Runs on escaped text: "**" is not touched by escapeHtml.
const bold = (html: string) => html.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

/** Block markdown: blank-line separated paragraphs and lists. */
export function markdownToHtml(md: string): string {
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inlineMd).join(" ")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const line of String(md ?? "").split(/\r?\n/)) {
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const item = ul ?? ol;
    if (item) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(item[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return html.join("\n");
}
