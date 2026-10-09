import { unzipSync, zipSync } from "fflate";

export interface P7bPayload {
  /** Zip entry path (may include folders); unique within one upload batch. */
  name: string;
  data: Uint8Array;
}

function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"), path.lastIndexOf(":"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function logicalPathFromZip(zipName: string, innerPath: string): string {
  const inner = innerPath.replace(/\\/g, "/");
  return `${zipName}:${inner}`;
}

function pushP7b(out: P7bPayload[], logicalName: string, data: Uint8Array) {
  const base = baseName(logicalName);
  if (!base.toLowerCase().endsWith(".p7b")) return;
  const zipEntry = logicalName.includes(":") ? logicalName.split(":").slice(1).join(":") : logicalName;
  const entry = zipEntry.replace(/\\/g, "/").replace(/^\/+/, "");
  out.push({ name: entry || base, data });
}

/** Collect raw .p7b bytes from user uploads (files or zip) for server-side PDF generation. */
export async function collectP7bFromFiles(files: File[], onlyLogicalNames?: Set<string>): Promise<P7bPayload[]> {
  const out: P7bPayload[] = [];
  for (const file of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        const entries = unzipSync(buf);
        for (const [path, data] of Object.entries(entries)) {
          const logical = logicalPathFromZip(file.name, path);
          if (onlyLogicalNames && !onlyLogicalNames.has(logical) && !onlyLogicalNames.has(path)) continue;
          pushP7b(out, logical, data);
        }
      } catch {
        /* skip corrupt zip */
      }
    } else {
      const logical = file.name;
      if (onlyLogicalNames && !onlyLogicalNames.has(logical)) continue;
      pushP7b(out, logical, buf);
    }
  }
  return disambiguateP7bPayloadNames(out);
}

export function disambiguateP7bPayloadNames(payloads: P7bPayload[]): P7bPayload[] {
  const byBase = new Map<string, P7bPayload[]>();
  for (const p of payloads) {
    const base = baseName(p.name);
    const list = byBase.get(base) ?? [];
    list.push(p);
    byBase.set(base, list);
  }
  const out: P7bPayload[] = [];
  for (const [, list] of byBase) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    for (const p of list) {
      const safe = p.name.replace(/\\/g, "/").replace(/\//g, "__");
      out.push({ name: safe, data: p.data });
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

/** Logical names used in ingest (File.name or zip:inner/path). */
export function groupP7bLogicalNames(group: { opisFile: string; days: { file: string }[] }): Set<string> {
  const names = new Set<string>();
  names.add(group.opisFile);
  for (const d of group.days) names.add(d.file);
  return names;
}
