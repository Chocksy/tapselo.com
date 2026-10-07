import { renderCashbook } from "../generators/cashbook.ts";
import { renderNir } from "../generators/nir.ts";
import type { CashbookPayload, DraftRecord, NirPayload } from "../generators/types.ts";
import { cashbookWorkbookXml, downloadBlob } from "./spreadsheet.ts";

const LOCAL_DRAFT: DraftRecord = {
  kind: "local",
  payload: null,
  expires_at: null,
};

export function cashbookHtml(payload: CashbookPayload): string {
  return renderCashbook(payload, { ...LOCAL_DRAFT, kind: "cashbook" });
}

export function nirHtml(payload: NirPayload): string {
  return renderNir(payload, { ...LOCAL_DRAFT, kind: "nir" });
}

export function openPrintHtml(html: string): boolean {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function downloadCashbookExcel(payload: CashbookPayload, filename?: string): void {
  const xml = cashbookWorkbookXml(payload);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const date = payload.date.replace(/-/g, "");
  downloadBlob(blob, filename ?? `registru-de-casa-${date}.xls`);
}

export function downloadNirPdfViaPrint(payload: NirPayload): boolean {
  return openPrintHtml(nirHtml(payload));
}

export function downloadCashbookPdfViaPrint(payload: CashbookPayload): boolean {
  return openPrintHtml(cashbookHtml(payload));
}
