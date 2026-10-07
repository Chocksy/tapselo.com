import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractXmlPayload } from "../src/lib/a4200/unwrap.ts";
import { classifyXml, parseDayXml, parseOpisXml, zFromAmefId } from "../src/lib/a4200/parse.ts";

/**
 * Optional local test against real Datecs exports (never committed).
 * Set A4200_SAMPLES_DIR to the root folder that contains .p7b exports.
 */
const samplesDir = process.env.A4200_SAMPLES_DIR;

function listP7bFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.name.toLowerCase().endsWith(".p7b")) out.push(full);
    }
  }
  return out;
}

test("real Datecs p7b extracts msj/mReg when samples dir is set", { skip: !samplesDir }, () => {
  const paths = listP7bFiles(samplesDir!);
  assert.ok(paths.length > 0, "no .p7b files under A4200_SAMPLES_DIR");

  let opisPath: string | undefined;
  let dayPath: string | undefined;

  for (const p of paths) {
    const extracted = extractXmlPayload(new Uint8Array(fs.readFileSync(p)));
    if (!extracted) continue;
    const kind = classifyXml(extracted.xml);
    if (kind === "opis" && !opisPath) opisPath = p;
    if (kind === "day" && !dayPath) dayPath = p;
  }

  assert.ok(opisPath, "no opis .p7b found");
  assert.ok(dayPath, "no day .p7b found");

  const day = extractXmlPayload(new Uint8Array(fs.readFileSync(dayPath)));
  const opis = extractXmlPayload(new Uint8Array(fs.readFileSync(opisPath)));
  assert.ok(day && classifyXml(day.xml) === "day");
  assert.ok(opis && classifyXml(opis.xml) === "opis");

  const parsedDay = parseDayXml(day!.xml, path.basename(dayPath));
  const parsedOpis = parseOpisXml(opis!.xml);
  assert.equal(parsedDay.nui, parsedOpis.nui);
  assert.equal(parsedDay.zReport, zFromAmefId(parsedDay.idM));
  assert.ok(parsedDay.zReport >= 0 && parsedDay.zReport <= 9999);
});
