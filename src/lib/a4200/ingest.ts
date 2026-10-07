import { unzipSync } from "fflate";
import { explainP7bExtractFailed } from "./explain.ts";
import { extractXmlPayload, isLikelyP7b } from "./unwrap.ts";
import { classifyXml, parseDayXml, parseOpisXml } from "./parse.ts";
import type { ClassifiedFile, FileKind } from "./types.ts";

export interface IngestResult {
  files: ClassifiedFile[];
}

function classifyOne(name: string, bytes: Uint8Array, source: ClassifiedFile["source"]): ClassifiedFile {
  const textTry = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let xml: string | undefined;
  let kind: FileKind = "unreadable";

  if (name.toLowerCase().endsWith(".xml") || textTry.trimStart().startsWith("<?xml")) {
    const extracted = extractXmlPayload(bytes) ?? extractXmlPayload(textTry);
    if (extracted) {
      xml = extracted.xml;
      kind = classifyXml(xml);
    }
  } else if (isLikelyP7b(name, bytes)) {
    const extracted = extractXmlPayload(bytes);
    if (!extracted) {
      const issue = explainP7bExtractFailed(name);
      return {
        name,
        kind: "unreadable",
        parseError: issue.ceInseamna,
        source,
      };
    }
    xml = extracted.xml;
    kind = classifyXml(xml);
  } else {
    const extracted = extractXmlPayload(bytes);
    if (extracted) {
      xml = extracted.xml;
      kind = classifyXml(xml);
    }
  }

  if (!xml) {
    return { name, kind: "foreign", source };
  }

  if (kind === "foreign") {
    return { name, kind: "foreign", xml, source };
  }

  try {
    if (kind === "opis") parseOpisXml(xml);
    else parseDayXml(xml, name);
    return { name, kind, xml, source };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare la citirea XML.";
    return { name, kind, parseError: msg, xml, source };
  }
}

function walkZip(zipName: string, bytes: Uint8Array): ClassifiedFile[] {
  const out: ClassifiedFile[] = [];
  try {
    const entries = unzipSync(bytes);
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith("/")) continue;
      const innerName = `${zipName}:${path}`;
      out.push(...expandBuffer(innerName, data, "zip"));
    }
  } catch {
    out.push({
      name: zipName,
      kind: "unreadable",
      parseError: "Arhiva ZIP este coruptă sau nu poate fi citită.",
      source: "zip",
    });
  }
  return out;
}

export function expandBuffer(name: string, bytes: Uint8Array, source: ClassifiedFile["source"] = "xml"): ClassifiedFile[] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return walkZip(name, bytes);
  return [classifyOne(name, bytes, source)];
}

export async function ingestFileList(files: File[]): Promise<IngestResult> {
  const classified: ClassifiedFile[] = [];
  for (const file of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    classified.push(...expandBuffer(file.name, buf, file.name.toLowerCase().endsWith(".p7b") ? "p7b" : "xml"));
  }
  return { files: classified };
}

export function ingestBuffers(entries: { name: string; data: Uint8Array }[]): IngestResult {
  const files: ClassifiedFile[] = [];
  for (const e of entries) files.push(...expandBuffer(e.name, e.data));
  return { files };
}
