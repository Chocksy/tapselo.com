// Run after `npm run build`. seoTitle / summaryBox on articles vs default rendering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

async function load(relative: string) {
  return readFile(join(process.cwd(), relative), "utf8");
}

test("cod-qr-bon-fiscal: seoTitle in title/og, H1 unchanged, summaryBox before body", async () => {
  const html = await load("dist/ghid/articole/cod-qr-bon-fiscal/index.html");
  const title = decode(/<title>([^<]*)<\/title>/.exec(html)![1]);
  assert.equal(title, "Cod QR pe bonul fiscal: amenzi suspendate până la 31.10.2027 | Ghid Tapselo");
  assert.match(html, /property="og:title" content="Cod QR pe bonul fiscal: amenzi suspendate până la 31\.10\.2027 \| Ghid Tapselo"/);
  const h1 = decode(/<h1[^>]*class="pg-h1"[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1].replace(/<[^>]+>/g, "").trim());
  assert.equal(h1, "Cod QR pe bonul fiscal: obligație, suspendare și amendă");
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  assert.match(main, /Pe scurt \(verificat la 18\.11\.2026\)/);
  const boxBeforeBody =
    main.indexOf("Pe scurt (verificat la 18.11.2026)") < main.indexOf("Obligația de a include datele cerute sub formă de cod QR");
  assert.ok(boxBeforeBody, "summary box precedes first body paragraph");
  assert.match(main, /OUG_43_2026\.pdf/);
});

test("depunere-a4200: title from article.title, no summaryBox callout", async () => {
  const html = await load("dist/ghid/articole/depunere-a4200/index.html");
  const title = decode(/<title>([^<]*)<\/title>/.exec(html)![1]);
  assert.equal(title, "Cum depui declarația A4200 cu DUKIntegrator | Ghid Tapselo");
  const h1 = decode(/<h1[^>]*class="pg-h1"[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1].replace(/<[^>]+>/g, "").trim());
  assert.equal(h1, "Cum depui declarația A4200 cu DUKIntegrator");
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  assert.doesNotMatch(main, /Pe scurt \(verificat la/);
});