import { unzipSync, zipSync } from "fflate";

export interface P7bPayload {
  name: string;
  data: Uint8Array;
}

function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function pushP7b(out: P7bPayload[], name: string, data: Uint8Array) {
  const base = baseName(name);
  if (!base.toLowerCase().endsWith(".p7b")) return;
  out.push({ name: base, data });
}

/** Collect raw .p7b bytes from user uploads (files or zip) for server-side PDF generation. */
export async function collectP7bFromFiles(files: File[]): Promise<P7bPayload[]> {
  const out: P7bPayload[] = [];
  for (const file of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        const entries = unzipSync(buf);
        for (const [path, data] of Object.entries(entries)) {
          pushP7b(out, path, data);
        }
      } catch {
        /* skip corrupt zip */
      }
    } else {
      pushP7b(out, file.name, buf);
    }
  }
  return out;
}

export function p7bPayloadsToZip(payloads: P7bPayload[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const p of payloads) {
    entries[p.name] = p.data;
  }
  return zipSync(entries);
}
