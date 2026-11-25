// Run after `npm run build`. In-body inbound links for TAP Nov targets (launch 11-02).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const dist = join(process.cwd(), "dist");

const TARGETS = {
  conformitate: {
    path: "/unelte/declaratie-de-conformitate-produse-alimentare/",
    title: "Declarație de conformitate produse alimentare — model gratuit (patiserie, prăjituri, torturi) | Tapselo",
    h1: "Declarație de conformitate pentru produse alimentare (model voluntar)",
    minSources: 3,
    sources: [
      "ghid/deschide-brutarie-patiserie",
      "ghid/deschide-minimarket-alimentara",
      "ghid/deschide-cafenea-bistro",
      "unelte/grafic-temperatura-frigider",
    ],
  },
  pvAnulare: {
    path: "/unelte/proces-verbal-anulare-bon-fiscal/",
    title: "Proces verbal anulare bon fiscal — generator gratuit PDF | Tapselo",
    h1: "Proces verbal de anulare bon fiscal (dosar art. 36, HG 479/2003)",
    minSources: 3,
    sources: [
      "ghid/erori-datecs/bon-deschis",
      "ghid/articole/raport-z-datecs-fp-70",
      "ghid/articole/cod-qr-bon-fiscal",
      "ghid/raport-z-memorie-fiscala-p7b",
    ],
  },
  certificat: {
    path: "/ghid/certificat-de-atestare-fiscala/",
    title: "Certificat de atestare fiscală online din SPV (PF și PJ) — pași, termen, valabilitate | Tapselo",
    h1: "Certificat de atestare fiscală online: cum îl ceri din SPV",
    minSources: 3,
    sources: [
      "ghid/deschide-brutarie-patiserie",
      "ghid/deschide-minimarket-alimentara",
      "ghid/deschide-macelarie",
      "ghid/deschide-cafenea-bistro",
      "ghid/declarare-punct-de-lucru-anaf",
    ],
  },
} as const;

function pageHtml(subpath: string): string {
  return readFileSync(join(dist, subpath, "index.html"), "utf8");
}

function mainInBodyLinks(html: string, href: string): string[] {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  const re = new RegExp(`<a href="${href.replace(/\//g, "\\/")}"[^>]*>([\\s\\S]*?)<\\/a>`, "g");
  const anchors: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(main))) {
    anchors.push(m[1].replace(/<[^>]+>/g, "").trim());
  }
  return anchors;
}

for (const [key, t] of Object.entries(TARGETS)) {
  test(`TAP-NOV-LINKS ${key}: target title/H1 unchanged and ≥${t.minSources} in-body inbound links`, () => {
    const targetHtml = pageHtml(t.path.replace(/^\//, "").replace(/\/$/, ""));
    const title = targetHtml.match(/<title>([^<]*)<\/title>/)?.[1];
    const h1 = targetHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
    assert.equal(title, t.title, "title");
    assert.equal(h1, t.h1, "h1");

    let total = 0;
    for (const src of t.sources) {
      const links = mainInBodyLinks(pageHtml(src), t.path);
      assert.ok(links.length <= 1, `${src} must link at most once to ${t.path}`);
      if (links.length === 1) total += 1;
    }
    assert.ok(total >= t.minSources, `expected ≥${t.minSources} sources with in-body links, got ${total}`);
  });
}