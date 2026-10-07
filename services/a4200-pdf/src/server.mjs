import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import Busboy from "busboy";
import { unzipSync } from "fflate";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 25 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 120_000);
const JAVA_TIMEOUT_MS = Number(process.env.JAVA_TIMEOUT_MS ?? 90_000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 20);
const DUK_JAR = process.env.DUK_JAR ?? "/duk/dist/DUKIntegrator.jar";
const DUK_HOME = process.env.DUK_HOME ?? dirname(DUK_JAR);

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "https://tapselo.com,https://www.tapselo.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateBuckets = new Map();

function log(msg) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg }));
}

function corsHeaders(origin) {
  if (!origin || !CORS_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function checkRate(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, b);
  }
  b.count += 1;
  return b.count <= RATE_LIMIT_MAX;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

async function readBodyLimited(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_BODY_BYTES, files: 64 } });
    const files = [];
    let zipBuf = null;

    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("limit", () => reject(new Error("PAYLOAD_TOO_LARGE")));
      file.on("end", () => {
        const buf = Buffer.concat(chunks);
        const name = info.filename || fieldname;
        if (fieldname === "zip" || name.toLowerCase().endsWith(".zip")) {
          zipBuf = buf;
        } else if (name.toLowerCase().endsWith(".p7b")) {
          files.push({ name: basename(name), data: buf });
        }
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ files, zipBuf }));
    req.pipe(busboy);
  });
}

async function extractZipToDir(zipBuf, dir) {
  const entries = unzipSync(new Uint8Array(zipBuf));
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/")) continue;
    const base = basename(path);
    if (!base.toLowerCase().endsWith(".p7b")) continue;
    await fs.writeFile(join(dir, base), Buffer.from(data));
  }
}

async function writeP7bFiles(dir, files) {
  for (const f of files) {
    const base = basename(f.name);
    if (!base.toLowerCase().endsWith(".p7b")) continue;
    await fs.writeFile(join(dir, base), f.data);
  }
}

async function findOpis(dir) {
  const names = await fs.readdir(dir);
  const p7b = names.filter((n) => n.toLowerCase().endsWith(".p7b"));
  const preferred = p7b.find((n) => /^perioada_raportare\.p7b$/i.test(n));
  if (preferred) return join(dir, preferred);
  const opisLike = p7b.filter((n) => /perioada|raportare/i.test(n));
  if (opisLike.length === 1) return join(dir, opisLike[0]);
  if (p7b.length === 0) throw new Error("NO_P7B");
  throw new Error("OPIS_AMBIGUOUS");
}

function runDuk(opisPath, workDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "java",
      ["-jar", DUK_JAR, "-p", "A4200", opisPath],
      { cwd: DUK_HOME, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("JAVA_TIMEOUT"));
    }, JAVA_TIMEOUT_MS);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

async function generatePdf(workDir) {
  const opisPath = await findOpis(workDir);
  const opisBase = basename(opisPath);
  await runDuk(opisPath, workDir);

  const pdfPath = join(workDir, `${opisBase}.pdf`);
  const errPath = join(workDir, `${opisBase}.err.txt`);

  try {
    const pdf = await fs.readFile(pdfPath);
    return { ok: true, pdf, contentType: "application/pdf" };
  } catch {
    let errText = "";
    try {
      errText = await fs.readFile(errPath, "utf8");
    } catch {
      errText = "DUKIntegrator nu a produs PDF și nu există .err.txt.";
    }
    return { ok: false, errText };
  }
}

async function handleA4200(req, res, origin) {
  const workDir = await fs.mkdtemp(join(tmpdir(), "a4200-"));
  try {
    const ct = req.headers["content-type"] ?? "";
    let files = [];
    if (ct.includes("multipart/form-data")) {
      const parsed = await parseMultipart(req);
      if (parsed.zipBuf) {
        await extractZipToDir(parsed.zipBuf, workDir);
      }
      files = parsed.files;
      if (files.length) await writeP7bFiles(workDir, files);
    } else if (ct.includes("application/zip") || ct.includes("application/x-zip-compressed")) {
      const zipBuf = await readBodyLimited(req, MAX_BODY_BYTES);
      await extractZipToDir(zipBuf, workDir);
    } else {
      res.writeHead(415, { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Folosește multipart (zip sau .p7b) sau application/zip." }));
      return;
    }

    const names = await fs.readdir(workDir);
    if (!names.some((n) => n.toLowerCase().endsWith(".p7b"))) {
      res.writeHead(400, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
      res.end("Nu am găsit fișiere .p7b în cerere.");
      return;
    }

    const result = await generatePdf(workDir);
    if (result.ok) {
      res.writeHead(200, {
        ...corsHeaders(origin),
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Perioada_raportare.p7b.pdf"',
      });
      res.end(result.pdf);
    } else {
      res.writeHead(422, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
      res.end(result.errText);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const ip = clientIp(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && (req.url === "/a4200" || req.url === "/a4200/")) {
    if (!checkRate(ip)) {
      res.writeHead(429, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
      res.end("Prea multe cereri. Încearcă din nou în câteva minute.");
      return;
    }

    const timer = setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(504, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
        res.end("Timpul alocat generării PDF a expirat.");
        req.destroy();
      }
    }, REQUEST_TIMEOUT_MS);

    try {
      await handleA4200(req, res, origin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "PAYLOAD_TOO_LARGE") {
        res.writeHead(413, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
        res.end("Arhiva sau fișierele depășesc limita permisă.");
      } else {
        log(`request_error:${msg}`);
        res.writeHead(500, { ...corsHeaders(origin), "Content-Type": "text/plain; charset=utf-8" });
        res.end("Eroare internă la generarea PDF.");
      }
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  log(`listening on ${PORT}`);
});
