#!/usr/bin/env node
/**
 * Fetch DUKIntegrator + A4200 kit jars from ANAF versiuni.xml (build time only).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSIUNI_URL =
  process.env.ANAF_VERSIUNI_URL ??
  "https://static.anaf.ro/static/10/Anaf/update5/versiuni.xml";

const OUT_DIST = process.argv[2] ?? join(process.cwd(), "duk", "dist");
const OUT_LIB = join(OUT_DIST, "lib");

const DECL_TAGS = ["A4200", "A4201", "A4202", "A4203"];

function extractUrls(xml, section) {
  const urls = [];
  const blockRe = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`, "i");
  const block = xml.match(blockRe)?.[1];
  if (!block) return urls;
  for (const m of block.matchAll(/<jarURL>([^<]+)<\/jarURL>/gi)) {
    urls.push(m[1].trim());
  }
  for (const m of block.matchAll(/<(JURL|PURL)>([^<]+)<\/(JURL|PURL)>/gi)) {
    urls.push(m[2].trim());
  }
  return urls;
}

async function download(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  console.log(`  ${destPath.split("/").pop()} (${buf.length} bytes)`);
}

async function main() {
  console.log(`Fetching ${VERSIUNI_URL}`);
  const xml = await fetch(VERSIUNI_URL).then((r) => {
    if (!r.ok) throw new Error(`versiuni.xml ${r.status}`);
    return r.text();
  });

  await mkdir(OUT_LIB, { recursive: true });

  const integrator = xml.match(/<integrator>([\s\S]*?)<\/integrator>/i)?.[1] ?? "";
  const integratorUrls = [
    ...extractUrls(integrator, "iJars"),
    ...extractUrls(integrator, "sJars"),
    ...extractUrls(integrator, "zJars"),
  ];

  const declUrls = [];
  for (const tag of DECL_TAGS) {
    const block = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
    if (!block) throw new Error(`Missing <${tag}> in versiuni.xml`);
    for (const m of block.matchAll(/<(JURL|PURL)>([^<]+)<\/(JURL|PURL)>/gi)) {
      declUrls.push(m[2].trim());
    }
  }

  const configBlock = integrator.match(/<cFisiere>([\s\S]*?)<\/cFisiere>/i)?.[1] ?? "";
  const configUrls = [];
  for (const m of configBlock.matchAll(/<fisierURL>([^<]+)<\/fisierURL>/gi)) {
    configUrls.push(m[1].trim());
  }
  const configDir = join(OUT_DIST, "config");
  await mkdir(configDir, { recursive: true });
  for (const url of configUrls) {
    const name = url.split("/").pop() ?? "config.dat";
    await download(url, join(configDir, name));
  }

  const all = [...integratorUrls, ...declUrls];
  const seen = new Set();
  for (const url of all) {
    if (seen.has(url)) continue;
    seen.add(url);
    const name = url.split("/").pop() ?? "unknown.jar";
    if (!name.toLowerCase().endsWith(".jar")) continue;
    const dest =
      name === "DUKIntegrator.jar" ? join(OUT_DIST, name) : join(OUT_LIB, name);
    await download(url, dest);
  }

  console.log(`Done: ${seen.size} jar URL(s) processed → ${OUT_DIST}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
