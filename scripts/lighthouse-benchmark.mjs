#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.LH_BASE_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.LH_OUT_DIR ?? "artifacts/lighthouse";
const LABEL = process.env.LH_LABEL ?? "run";

const paths = [
  "/",
  "/ghid/articole/casa-de-marcat-fara-internet/",
  "/unelte/calculator-tva/",
];

const presets = [
  { id: "mobile", extra: ["--form-factor=mobile", "--screenEmulation.mobile", "--throttling-method=simulate"] },
  { id: "desktop", extra: ["--preset=desktop", "--form-factor=desktop", "--screenEmulation.mobile=false", "--throttling-method=simulate"] },
];

function runLighthouse(url, outFile, extra) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--output=json",
      `--output-path=${outFile}`,
      "--quiet",
      "--chrome-flags=--headless --no-sandbox --disable-gpu",
      ...extra,
    ];
    const child = spawn("npx", ["--yes", "lighthouse@12.8.2", ...args], {
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`lighthouse exit ${code}`))));
  });
}

function pickMetrics(report) {
  const c = report.categories;
  const a = report.audits;
  return {
    performance: Math.round((c.performance?.score ?? 0) * 100),
    accessibility: Math.round((c.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((c["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((c.seo?.score ?? 0) * 100),
    lcp: a["largest-contentful-paint"]?.displayValue ?? "—",
    cls: a["cumulative-layout-shift"]?.displayValue ?? "—",
    tbt: a["total-blocking-time"]?.displayValue ?? "—",
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const summary = {};

  for (const preset of presets) {
    for (const p of paths) {
      const slug = p === "/" ? "home" : p.replace(/^\/|\/$/g, "").replace(/\//g, "_");
      const outFile = path.join(OUT, `${LABEL}-${preset.id}-${slug}.json`);
      const url = `${BASE}${p}`;
      console.log(`\n→ ${preset.id} ${url}`);
      await runLighthouse(url, outFile, preset.extra);
      const report = JSON.parse(await readFile(outFile, "utf8"));
      const key = `${preset.id}:${slug}`;
      summary[key] = pickMetrics(report);
    }
  }

  await writeFile(path.join(OUT, `${LABEL}-summary.json`), JSON.stringify(summary, null, 2));
  console.log("\nSummary:", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
