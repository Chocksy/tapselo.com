#!/usr/bin/env node
/**
 * Builds extensions/verificare-cui/dist/verificare-cui.zip for Chrome Web Store upload.
 * Run: node extensions/verificare-cui/scripts/build-zip.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "dist");
const zipPath = join(outDir, "verificare-cui.zip");

const SKIP = new Set(["dist", "scripts", ".DS_Store"]);

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (SKIP.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) files.push(...(await walk(full, base)));
    else files.push(relative(base, full));
  }
  return files;
}

async function buildZip() {
  const files = await walk(root);
  await mkdir(outDir, { recursive: true });

  const args = ["-j", zipPath, ...files.map((f) => join(root, f))];
  // zip -j flattens paths; we need directory structure — use cd + zip -r
  const relFiles = files.sort();
  const zip = spawnSync("zip", ["-r", "-q", zipPath, ...relFiles], { cwd: root, encoding: "utf8" });
  if (zip.status !== 0) {
    console.error(zip.stderr || zip.stdout);
    throw new Error(`zip failed with code ${zip.status}`);
  }

  const { size } = await stat(zipPath);
  console.log(`Wrote ${zipPath} (${size} bytes), ${relFiles.length} files`);
}

buildZip().catch((e) => {
  console.error(e);
  process.exit(1);
});
