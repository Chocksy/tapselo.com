// Shared helpers for dist/ internal-link crawl checks (used by seo-crawl.test.ts).
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const SITE = "https://tapselo.com";

export type CrawlIssue = { from: string; href: string; kind: "utm" | "no_slash" | "email_protection" };

/** Map dist/foo/index.html → URL path /foo/ */
export function distFileToPath(file: string, distDir: string): string {
  const rel = relative(distDir, file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  const m = /^(.+)\/index\.html$/.exec(rel);
  if (m) return `/${m[1]}/`;
  return `/${rel}`;
}

export async function listHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

function isInternalHref(href: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return false;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      const u = new URL(href);
      return u.hostname === "tapselo.com" || u.hostname === "www.tapselo.com";
    } catch {
      return false;
    }
  }
  return href.startsWith("/");
}

function normalizeInternalPath(href: string): { path: string; hash: string } {
  const u = href.startsWith("http") ? new URL(href) : new URL(href, SITE);
  return { path: u.pathname, hash: u.hash };
}

/** Paths that should end with / (every HTML page except root). */
export function needsTrailingSlash(pathname: string): boolean {
  if (pathname === "/") return false;
  return !pathname.endsWith("/");
}

export function extractAnchors(html: string): string[] {
  const hrefs: string[] = [];
  const re = /<a\s[^>]*href=["']([^"']+)["']/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) hrefs.push(m[1]);
  return hrefs;
}

export function analyzeHref(fromPath: string, href: string): CrawlIssue | null {
  if (!isInternalHref(href)) return null;
  const { path, hash } = normalizeInternalPath(href);
  const full = `${path}${hash}`;
  if (full.includes("utm_") || href.includes("utm_")) {
    return { from: fromPath, href, kind: "utm" };
  }
  if (path.includes("/cdn-cgi/l/email-protection")) {
    return { from: fromPath, href, kind: "email_protection" };
  }
  if (needsTrailingSlash(path)) {
    return { from: fromPath, href, kind: "no_slash" };
  }
  return null;
}

export async function crawlDist(distDir: string): Promise<CrawlIssue[]> {
  const files = await listHtmlFiles(distDir);
  const issues: CrawlIssue[] = [];
  for (const file of files) {
    const from = distFileToPath(file, distDir);
    const html = await readFile(file, "utf8");
    for (const href of extractAnchors(html)) {
      const issue = analyzeHref(from, href);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

export async function parseSitemapUrls(distDir: string): Promise<Set<string>> {
  const indexPath = join(distDir, "sitemap-index.xml");
  let xml = await readFile(indexPath, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const all = new Set<string>();
  for (const loc of locs) {
    if (loc.endsWith(".xml")) {
      const sub = await readFile(join(distDir, loc.replace(SITE + "/", "")), "utf8").catch(() => "");
      for (const m of sub.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        all.add(new URL(m[1]).pathname);
      }
    } else {
      all.add(new URL(loc).pathname);
    }
  }
  return all;
}

export function ghidUneltePathsFromDist(distDir: string, files: string[]): string[] {
  return files
    .map((f) => distFileToPath(f, distDir))
    .filter((p) => p.startsWith("/ghid/") || p.startsWith("/unelte/"))
    .sort();
}

/** BFS link graph from homepage; only internal same-origin paths. */
export async function linkDepthFromHome(distDir: string): Promise<Map<string, number>> {
  const files = await listHtmlFiles(distDir);
  const pathToFile = new Map<string, string>();
  for (const f of files) pathToFile.set(distFileToPath(f, distDir), f);

  const adj = new Map<string, Set<string>>();
  for (const [path, file] of pathToFile) {
    const html = await readFile(file, "utf8");
    const neighbors = new Set<string>();
    for (const href of extractAnchors(html)) {
      if (!isInternalHref(href)) continue;
      const { path: p } = normalizeInternalPath(href);
      const canon = p === "/" ? "/" : p.endsWith("/") ? p : `${p}/`;
      if (pathToFile.has(canon)) neighbors.add(canon);
    }
    adj.set(path, neighbors);
  }

  const depth = new Map<string, number>([["/", 0]]);
  const q: string[] = ["/"];
  while (q.length) {
    const cur = q.shift()!;
    const d = depth.get(cur)!;
    for (const n of adj.get(cur) ?? []) {
      if (depth.has(n)) continue;
      depth.set(n, d + 1);
      q.push(n);
    }
  }
  return depth;
}
