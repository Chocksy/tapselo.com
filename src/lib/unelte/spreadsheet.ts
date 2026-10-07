// Registrul de casă as a real .xlsx (Office Open XML), built with fflate: amounts are numeric
// cells with a 2-decimal format, so they can be summed and re-calculated in Excel/LibreOffice.

import { strToU8, zipSync } from "fflate";
import { cashbookCalc } from "../generators/cashbook.ts";
import type { CashbookPayload } from "../generators/types.ts";
import { formatDate } from "../generators/page.ts";

type Cell = string | number | null | { text: string; bold: true };
type Row = Cell[];

/** Style ids in styles.xml: 0 default, 1 bold, 2 number #,##0.00, 3 bold number. */
const S_BOLD = 1;
const S_NUM = 2;
const S_BOLD_NUM = 3;

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function colName(i: number): string {
  return String.fromCharCode(65 + i);
}

function cellXml(c: Cell, ref: string, boldRow: boolean): string {
  if (c === null || c === "") return "";
  if (typeof c === "number") return `<c r="${ref}" s="${boldRow ? S_BOLD_NUM : S_NUM}"><v>${c}</v></c>`;
  const text = typeof c === "string" ? c : c.text;
  const bold = boldRow || typeof c !== "string";
  return `<c r="${ref}" t="inlineStr"${bold ? ` s="${S_BOLD}"` : ""}><is><t xml:space="preserve">${escXml(text)}</t></is></c>`;
}

export function cashbookRows(p: CashbookPayload): { rows: Row[]; boldRows: Set<number> } {
  const c = cashbookCalc(p);
  const rows: Row[] = [
    [{ text: "Registrul de casă", bold: true }],
    ["Unitatea:", p.company, null, "Data:", formatDate(p.date) ?? p.date],
    ["Contul:", "5311 Casa în lei", null, "Valori în lei"],
    [],
    ["Nr. crt.", "Nr. act casă", "Nr. anexe", "Explicații", "Încasări", "Plăți", "Sold"],
    [null, null, null, "Report/Sold ziua precedentă", null, null, p.opening_balance],
  ];
  const boldRows = new Set<number>([4]);
  p.entries.forEach((e, i) => {
    rows.push([i + 1, e.doc, e.annexes ?? null, e.description, e.receipt ?? null, e.payment ?? null, c.balances[i]]);
  });
  boldRows.add(rows.length);
  rows.push(["TOTAL", null, null, null, c.total_receipts, c.total_payments, null]);
  boldRows.add(rows.length);
  rows.push(["Sold final", null, null, null, null, null, c.closing_balance]);
  if (c.warnings.length) {
    rows.push([]);
    for (const w of c.warnings) rows.push([{ text: `Atenție: ${w}`, bold: true }]);
  }
  rows.push([], ["Casier (nume, prenume, semnătura)", null, null, "Compartiment financiar-contabil (nume, prenume, semnătura)"]);
  return { rows, boldRows };
}

function sheetXml(rows: Row[], boldRows: Set<number>): string {
  const body = rows
    .map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => cellXml(c, `${colName(ci)}${ri + 1}`, boldRows.has(ri))).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="3" width="13" customWidth="1"/><col min="4" max="4" width="42" customWidth="1"/><col min="5" max="7" width="14" customWidth="1"/></cols>
<sheetData>${body}</sheetData>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Registru" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// numFmtId 4 is the built-in "#,##0.00"; Excel shows it with the user's locale separators (1.234,50 in RO).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
</styleSheet>`;

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function cashbookXlsx(p: CashbookPayload): Uint8Array {
  const { rows, boldRows } = cashbookRows(p);
  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(ROOT_RELS),
    "xl/workbook.xml": strToU8(WORKBOOK),
    "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS),
    "xl/styles.xml": strToU8(STYLES),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(rows, boldRows)),
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
