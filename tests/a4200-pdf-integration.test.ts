import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = path.join(__dirname, "../services/a4200-pdf");
const FIX_ZIP = path.join(__dirname, "fixtures/a4200/datecs-anon.zip");

function run(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timeout: ${cmd} ${args.join(" ")}`));
    }, opts.timeout ?? 600_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", reject);
  });
}

async function dockerAvailable(): Promise<boolean> {
  try {
    const r = await run("docker", ["info"], { timeout: 30_000 });
    return r.code === 0;
  } catch {
    return false;
  }
}

function ensureFixtureZip() {
  const fixDir = path.join(__dirname, "fixtures/a4200/datecs-anon");
  if (fs.existsSync(FIX_ZIP)) return;
  if (!fs.existsSync(fixDir)) return;
  const entries: Record<string, Uint8Array> = {};
  for (const name of fs.readdirSync(fixDir)) {
    if (!name.toLowerCase().endsWith(".p7b")) continue;
    entries[name] = new Uint8Array(fs.readFileSync(path.join(fixDir, name)));
  }
  fs.writeFileSync(FIX_ZIP, zipSync(entries));
}

test(
  "A4200 PDF service (Docker): anonymized fixtures → PDF or DUK err text",
  { timeout: 900_000 },
  async (t) => {
    if (!(await dockerAvailable())) {
      t.skip("Docker not available");
      return;
    }
    ensureFixtureZip();
    if (!fs.existsSync(FIX_ZIP)) {
      t.skip("fixture zip missing");
      return;
    }

    const image = "a4200-pdf-test:local";
    const build = await run("docker", ["build", "-t", image, "."], { cwd: SERVICE_DIR, timeout: 900_000 });
    assert.equal(build.code, 0, `docker build failed:\n${build.stderr}`);

    const containerName = `a4200-pdf-it-${Date.now()}`;
    const runContainer = await run(
      "docker",
      ["run", "-d", "--rm", "--name", containerName, "-p", "9878:8787", image],
      { timeout: 60_000 },
    );
    assert.equal(runContainer.code, 0, runContainer.stderr);

    try {
      let healthy = false;
      for (let i = 0; i < 30; i++) {
        try {
          const h = await fetch("http://127.0.0.1:9878/health");
          if (h.ok) {
            healthy = true;
            break;
          }
        } catch {
          /* wait */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      assert.ok(healthy, "service /health");

      const zipBody = fs.readFileSync(FIX_ZIP);
      const res = await fetch("http://127.0.0.1:9878/a4200", {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: zipBody,
      });

      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok) {
        assert.ok(buf.subarray(0, 4).toString() === "%PDF", "expected PDF header");
      } else {
        const text = buf.toString("utf8");
        assert.equal(res.status, 422);
        assert.ok(text.length > 0, "expected DUKIntegrator .err.txt body");
        // Self-signed / anonymized fixtures may fail signature validation; document outcome.
        t.diagnostic(`DUKIntegrator rejected anonymized fixtures: ${text.slice(0, 200)}`);
      }
    } finally {
      await run("docker", ["stop", containerName], { timeout: 30_000 }).catch(() => {});
    }
  },
);
