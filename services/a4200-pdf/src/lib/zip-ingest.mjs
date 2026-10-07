import { basename, join } from "node:path";
import fs from "node:fs/promises";
import { unzipSync } from "fflate";
import { ClientError } from "./client-error.mjs";

export const MAX_ZIP_ENTRIES = Number(process.env.MAX_ZIP_ENTRIES ?? 64);
export const MAX_UNZIPPED_BYTES = Number(process.env.MAX_UNZIPPED_BYTES ?? 80 * 1024 * 1024);

/**
 * @returns {Map<string, Buffer>} basename → data (deduped; last wins)
 */
export function parseZipP7bEntries(zipBuf, limits = {}) {
  const maxEntries = limits.maxEntries ?? MAX_ZIP_ENTRIES;
  const maxUnzipped = limits.maxUnzipped ?? MAX_UNZIPPED_BYTES;
  let entries;
  try {
    entries = unzipSync(new Uint8Array(zipBuf));
  } catch {
    throw new ClientError(
      400,
      "Arhiva ZIP este coruptă sau nu poate fi citită.",
      "Reexportă memoria fiscală într-un ZIP nou sau încarcă fișierele .p7b direct.",
      "ZIP_CORRUPT",
    );
  }

  const fileEntries = Object.entries(entries).filter(([p]) => !p.endsWith("/"));
  if (fileEntries.length > maxEntries) {
    throw new ClientError(
      413,
      "Arhiva conține prea multe fișiere.",
      "Trimite doar opisul și zilele fiscale .p7b, fără alte documente.",
      "ZIP_TOO_MANY_ENTRIES",
    );
  }

  let unzipped = 0;
  const byBase = new Map();
  const seen = new Set();

  for (const [path, data] of fileEntries) {
    const base = basename(path);
    if (!base.toLowerCase().endsWith(".p7b")) continue;
    unzipped += data.byteLength;
    if (unzipped > maxUnzipped) {
      throw new ClientError(
        413,
        "Fișierele dezarhivate depășesc limita permisă.",
        "Reduce numărul de zile sau încarcă un set mai mic per cerere.",
        "ZIP_BOMB",
      );
    }
    if (seen.has(base)) {
      throw new ClientError(
        400,
        `Fișier duplicat în arhivă: ${base}.`,
        "Păstrează o singură copie a fiecărei zile fiscale și reîncearcă.",
        "ZIP_DUPLICATE",
      );
    }
    seen.add(base);
    byBase.set(base, Buffer.from(data));
  }

  return byBase;
}

export async function writeP7bMapToDir(dir, map) {
  for (const [name, data] of map) {
    await fs.writeFile(join(dir, name), data);
  }
}

export async function writeP7bFiles(dir, files) {
  const seen = new Set();
  for (const f of files) {
    const base = basename(f.name);
    if (!base.toLowerCase().endsWith(".p7b")) continue;
    if (seen.has(base)) {
      throw new ClientError(
        400,
        `Fișier duplicat în cerere: ${base}.`,
        "Încarcă o singură copie a fiecărui .p7b.",
        "DUPLICATE_P7B",
      );
    }
    seen.add(base);
    await fs.writeFile(join(dir, base), f.data);
  }
}
