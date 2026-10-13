// Tiny markdown to HTML for the KB bodies on /ghid pages.
// Supports ##/### headings, paragraphs, **bold**, `code`, "- " and "1. " lists,
// [text](url) links, and pipe tables. Everything else is escaped.

import { escapeHtml } from "./offers-render.ts";
import { internalPath } from "./internal-url.ts";

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(u) || /^\/[^\s"'<>]*$/.test(u) || /^#[\w-]+$/.test(u)) return u;
  return null;
}

/** Stable id for heading anchors (Romanian diacritics stripped). */
export function slugifyHeading(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "section";
}

const EMAIL_OFF_RE = /<!--email_off-->([\s\S]*?)<!--\/email_off-->/g;

/** Plain text for JSON-LD / meta: strip markdown without rendering HTML. */
export function markdownToPlainText(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(EMAIL_OFF_RE, (_, inner) => inner.trim());
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
  s = s.replace(/\*\*([^*]+?)\*\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  return s.replace(/\s+/g, " ").trim();
}

function inlineMdCore(raw: string): string {
  const out: string[] = [];
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

/** Inline markdown on one line of raw text; returns HTML. */
export function inlineMd(raw: string): string {
  const placeholders: string[] = [];
  const masked = raw.replace(EMAIL_OFF_RE, (_, inner) => {
    const i = placeholders.length;
    placeholders.push(`<!--email_off-->${escapeHtml(inner.trim())}<!--/email_off-->`);
    return `\x00EMAILOFF${i}\x00`;
  });
  let html = inlineMdCore(masked);
  for (let i = 0; i < placeholders.length; i++) {
    html = html.replace(`\x00EMAILOFF${i}\x00`, placeholders[i]);
  }
  return html;
}

const bold = (html: string) => html.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.includes("|");
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!isTableRow(line)) return false;
  return t.replace(/[|\s:-]/g, "") === "";
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(rows: string[][]): string {
  if (rows.length < 2) return "";
  const [head, ...body] = rows;
  const thead = `<thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<table class="kb-table">${thead}${tbody}</table>`;
}

/** H2 titles for in-page TOC (order preserved). */
export function markdownH2Toc(md: string): { id: string; title: string }[] {
  const slugCounts = new Map<string, number>();
  const toc: { id: string; title: string }[] = [];
  for (const line of String(md ?? "").split(/\r?\n/)) {
    const h2 = /^##\s+(.+)$/.exec(line.trim());
    if (!h2) continue;
    const title = h2[1].trim();
    const base = slugifyHeading(title);
    const n = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    toc.push({ id, title });
  }
  return toc;
}

/** Block markdown: blank-line separated paragraphs, lists, headings, tables. */
export function markdownToHtml(md: string): string {
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let tableLines: string[] = [];
  const slugCounts = new Map<string, number>();

  const headingId = (title: string): string => {
    const base = slugifyHeading(title);
    const n = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inlineMd).join(" ")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushTable = () => {
    if (tableLines.length === 0) return;
    const parsed: string[][] = [];
    for (const row of tableLines) {
      if (isTableSeparator(row)) continue;
      parsed.push(parseTableRow(row));
    }
    if (parsed.length) html.push(renderTable(parsed));
    tableLines = [];
  };

  const lines = String(md ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isTableRow(line)) {
      flushPara();
      flushList();
      tableLines.push(line);
      continue;
    }
    flushTable();

    const h3 = /^###\s+(.+)$/.exec(trimmed);
    if (h3) {
      flushPara();
      flushList();
      const title = h3[1].trim();
      const id = headingId(title);
      html.push(`<h3 id="${escapeHtml(id)}" class="kb-h3">${inlineMd(title)}</h3>`);
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    if (h2) {
      flushPara();
      flushList();
      const title = h2[1].trim();
      const id = headingId(title);
      html.push(`<h2 id="${escapeHtml(id)}" class="kb-h2">${inlineMd(title)}</h2>`);
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const item = ul ?? ol;
    if (item) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(item[1]);
    } else if (!trimmed) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(trimmed);
    }
  }
  flushPara();
  flushList();
  flushTable();
  return html.join("\n");
}
