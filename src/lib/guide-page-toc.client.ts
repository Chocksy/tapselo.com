/** Client-side “Pe pagină” TOC: build from article headings + scroll-spy active link. */

type TocItem = { id: string; title: string; level: 2 | 3; el: HTMLElement };

function slugifyHeading(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "section";
}

function ensureHeadingId(heading: HTMLElement, slugCounts: Map<string, number>): string {
  const existing = heading.id?.trim();
  if (existing) return existing;

  const section = heading.closest("section[id]");
  if (section?.id) return section.id;

  const base = slugifyHeading(heading.textContent ?? "");
  const n = (slugCounts.get(base) ?? 0) + 1;
  slugCounts.set(base, n);
  const id = n === 1 ? base : `${base}-${n}`;
  heading.id = id;
  return id;
}

function collectHeadings(root: HTMLElement): TocItem[] {
  const slugCounts = new Map<string, number>();
  const items: TocItem[] = [];
  for (const el of root.querySelectorAll("h2, h3")) {
    if (!(el instanceof HTMLElement)) continue;
    const title = el.textContent?.trim();
    if (!title) continue;
    const level = el.tagName === "H3" ? 3 : 2;
    const id = ensureHeadingId(el, slugCounts);
    items.push({ id, title, level, el });
  }
  return items;
}

export function initGuidePageToc(): void {
  const root = document.querySelector<HTMLElement>("[data-guide-toc-root]");
  const aside = document.querySelector<HTMLElement>("[data-guide-page-toc]");
  const list = aside?.querySelector<HTMLUListElement>(".guide-page-toc__list");
  if (!root || !aside || !list) return;

  const items = collectHeadings(root);
  if (items.length === 0) return;

  list.replaceChildren();
  const linkById = new Map<string, HTMLAnchorElement>();

  const setActive = (id: string) => {
    for (const [key, link] of linkById) {
      const active = key === id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  for (const item of items) {
    const li = document.createElement("li");
    li.className = item.level === 3 ? "guide-page-toc__item guide-page-toc__item--h3" : "guide-page-toc__item";
    const a = document.createElement("a");
    a.href = `#${item.id}`;
    a.textContent = item.title;
    a.className = "guide-page-toc__link text-accent hover:text-accent-hover";
    a.addEventListener("click", () => setActive(item.id));
    linkById.set(item.id, a);
    li.append(a);
    list.append(li);
  }

  aside.hidden = false;

  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (!id) continue;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      const ordered = items.filter((i) => visible.has(i.id));
      if (ordered.length > 0) {
        setActive(ordered[0].id);
        return;
      }
      const scrollY = window.scrollY + 120;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        if (item.el.offsetTop <= scrollY) current = item.id;
      }
      if (current) setActive(current);
    },
    { rootMargin: "-20% 0px -70% 0px", threshold: [0, 0.1, 1] },
  );

  for (const item of items) observer.observe(item.el);

  const hash = window.location.hash.replace(/^#/, "");
  if (hash && linkById.has(hash)) setActive(hash);
  else if (items[0]) setActive(items[0].id);
}
