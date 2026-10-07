import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ClientError, JavaTimeoutError } from "./lib/client-error.mjs";
import { parseMultipartBody } from "./lib/multipart.mjs";
import {
  JAVA_TIMEOUT_RESPONSE,
  RATE_LIMIT_RESPONSE,
  REQUEST_TIMEOUT_RESPONSE,
} from "./lib/api-errors.mjs";
import { clientIp } from "./lib/client-ip.mjs";
import { checkRate } from "./lib/rate-limit.mjs";
import { opisPathInDir } from "./lib/opis-resolve.mjs";
import {
  parseZipP7bEntries,
  writeP7bMapToDir,
  writeP7bFiles,
} from "./lib/zip-ingest.mjs";
import { formatDuk422Payload } from "./lib/duk-format.mjs";
import { buildPdfDownloadName } from "./lib/pdf-filename.mjs";
import {
  safeEnd,
  sendClientError,
  sendDukValidationError,
  sendApiError,
} from "./lib/respond.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 25 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 120_000);
const JAVA_TIMEOUT_MS = Number(process.env.JAVA_TIMEOUT_MS ?? 90_000);
const DUK_JAR = process.env.DUK_JAR ?? "/duk/dist/DUKIntegrator.jar";
const DUK_HOME = process.env.DUK_HOME ?? dirname(DUK_JAR);

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "https://tapselo.com,https://www.tapselo.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function log(msg) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg }));
}

export function corsHeaders(origin) {
  if (!origin || !CORS_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function readBodyLimited(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new ClientError(
        413,
        "Arhiva sau fișierele depășesc limita permisă.",
        "Trimite un set mai mic (doar opisul și zilele din perioadă).",
        "PAYLOAD_TOO_LARGE",
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function runDuk(opisPath) {
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
      reject(new JavaTimeoutError());
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
  const names = await fs.readdir(workDir);
  const opisPath = opisPathInDir(workDir, names);
  const opisBase = basename(opisPath);
  const opisBytes = await fs.readFile(opisPath);
  const downloadName = buildPdfDownloadName(opisBytes);

  await runDuk(opisPath);

  const pdfPath = join(workDir, `${opisBase}.pdf`);
  const errPath = join(workDir, `${opisBase}.err.txt`);

  try {
    const pdf = await fs.readFile(pdfPath);
    return { ok: true, pdf, downloadName };
  } catch {
    let errText = "";
    try {
      errText = await fs.readFile(errPath, "utf8");
    } catch {
      errText = "DUKIntegrator nu a produs PDF și nu există .err.txt.";
    }
    return { ok: false, payload: formatDuk422Payload(errText) };
  }
}

export async function handleA4200(req, res, origin) {
  const workDir = await fs.mkdtemp(join(tmpdir(), "a4200-"));
  try {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart/form-data")) {
      const body = await readBodyLimited(req, MAX_BODY_BYTES);
      const parsed = await parseMultipartBody(body, ct, MAX_BODY_BYTES);
      if (parsed.zipBuf) {
        const map = parseZipP7bEntries(parsed.zipBuf);
        await writeP7bMapToDir(workDir, map);
      }
      if (parsed.files.length) await writeP7bFiles(workDir, parsed.files);
    } else if (ct.includes("application/zip") || ct.includes("application/x-zip-compressed")) {
      const zipBuf = await readBodyLimited(req, MAX_BODY_BYTES);
      const map = parseZipP7bEntries(zipBuf);
      await writeP7bMapToDir(workDir, map);
    } else {
      throw new ClientError(
        415,
        "Format de cerere neacceptat.",
        "Folosește multipart (câmp zip sau fișiere .p7b) sau trimite application/zip.",
        "UNSUPPORTED_MEDIA",
      );
    }

    const dirNames = await fs.readdir(workDir);
    if (!dirNames.some((n) => n.toLowerCase().endsWith(".p7b"))) {
      throw new ClientError(
        400,
        "Nu am găsit fișiere .p7b în cerere.",
        "Include Perioada_raportare.p7b și zilele NUI_Zxxxx.p7b.",
        "NO_P7B",
      );
    }

    const result = await generatePdf(workDir);
    if (result.ok) {
      safeEnd(res, 200, {
        ...corsHeaders(origin),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.downloadName}"`,
      }, result.pdf);
    } else {
      sendDukValidationError(res, origin, corsHeaders, result.payload);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function handleRouteError(res, origin, e) {
  if (e instanceof ClientError) {
    sendClientError(res, origin, corsHeaders, e);
    return;
  }
  if (e instanceof JavaTimeoutError) {
    sendApiError(res, origin, corsHeaders, 504, JAVA_TIMEOUT_RESPONSE);
    return;
  }
  const msg = e instanceof Error ? e.message : String(e);
  log(`request_error:${msg}`);
  safeEnd(res, 500, {
    ...corsHeaders(origin),
    "Content-Type": "text/plain; charset=utf-8",
  }, "Eroare internă la generarea PDF.");
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const ip = clientIp(req);

  if (req.method === "OPTIONS") {
    safeEnd(res, 204, corsHeaders(origin), "");
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    safeEnd(res, 200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && (req.url === "/a4200" || req.url === "/a4200/")) {
    if (!checkRate(ip)) {
      sendApiError(res, origin, corsHeaders, 429, RATE_LIMIT_RESPONSE);
      return;
    }

    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      sendApiError(res, origin, corsHeaders, 504, REQUEST_TIMEOUT_RESPONSE);
      req.destroy();
    }, REQUEST_TIMEOUT_MS);

    try {
      await handleA4200(req, res, origin);
    } catch (e) {
      if (!res.headersSent && !res.writableEnded) {
        handleRouteError(res, origin, e);
      }
    } finally {
      finished = true;
      clearTimeout(timer);
    }
    return;
  }

  safeEnd(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
});

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  server.listen(PORT, () => {
    log(`listening on ${PORT}`);
  });
}

export { server, MAX_BODY_BYTES, JAVA_TIMEOUT_MS };
