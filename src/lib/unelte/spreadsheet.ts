import { cashbookCalc } from "../generators/cashbook.ts";
import type { CashbookPayload } from "../generators/types.ts";
import { fmtMoney, formatDate } from "../generators/page.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel 2003 XML Spreadsheet — opens in Excel/LibreOffice without extra deps. */
export function cashbookWorkbookXml(p: CashbookPayload): string {
  const c = cashbookCalc(p);
  const dateLabel = formatDate(p.date) ?? p.date;
  const rows: string[][] = [
    ["Registru de casă"],
    ["Unitatea:", p.company, "", "Data:", dateLabel, "", "Valori în lei"],
    [],
    ["Nr. crt.", "Nr. act casă", "Explicații", "Încasări", "Plăți", "Sold"],
    ["", "", "Sold din ziua precedentă", "", "", fmtMoney(p.opening_balance)],
  ];
  p.entries.forEach((e, i) => {
    rows.push([
      String(i + 1),
      e.doc,
      e.description,
      e.receipt ? fmtMoney(e.receipt) : "",
      e.payment ? fmtMoney(e.payment) : "",
      fmtMoney(c.balances[i]),
    ]);
  });
  rows.push(["", "", "Total ziua", fmtMoney(c.total_receipts), fmtMoney(c.total_payments), ""]);
  rows.push(["", "", "Sold final", "", "", fmtMoney(c.closing_balance)]);

  const rowXml = rows
    .map((cells) => {
      const cellXml = cells.map((v) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("");
      return `<Row>${cellXml}</Row>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Registru">
<Table>
${rowXml}
</Table>
</Worksheet>
</Workbook>`;
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
