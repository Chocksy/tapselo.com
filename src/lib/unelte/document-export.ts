import { renderCashbook } from "../generators/cashbook.ts";
import { renderNir } from "../generators/nir.ts";
import { renderWarehouseCard } from "../generators/warehouse-card.ts";
import type { CashbookPayload, DraftRecord, NirPayload, WarehouseCardPayload } from "../generators/types.ts";
import { cashbookXlsx, downloadBlob, XLSX_MIME } from "./spreadsheet.ts";

const LOCAL_DRAFT: DraftRecord = {
  kind: "local",
  payload: null,
  expires_at: null,
};

export function cashbookHtml(payload: CashbookPayload): string {
  return renderCashbook(payload, { ...LOCAL_DRAFT, kind: "cashbook" }, { local: true });
}

export function nirHtml(payload: NirPayload): string {
  return renderNir(payload, { ...LOCAL_DRAFT, kind: "nir" }, { local: true });
}

/**
 * Opens the printable document in a new tab. Must run inside the click handler (popup blockers).
 * No "noopener" feature: with it, window.open always returns null and the tab stays blank.
 * The opener link is cut by hand before writing, and every user text in `html` is escaped by the renderers.
 */
export function openPrintHtml(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.opener = null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function downloadCashbookExcel(payload: CashbookPayload, filename?: string): void {
  const blob = new Blob([cashbookXlsx(payload) as Uint8Array<ArrayBuffer>], { type: XLSX_MIME });
  const date = payload.date.replace(/-/g, "");
  downloadBlob(blob, filename ?? `registru-de-casa-${date}.xlsx`);
}

export function downloadNirPdfViaPrint(payload: NirPayload): boolean {
  return openPrintHtml(nirHtml(payload));
}

export function downloadCashbookPdfViaPrint(payload: CashbookPayload): boolean {
  return openPrintHtml(cashbookHtml(payload));
}

export function warehouseCardHtml(payload: WarehouseCardPayload, blank = false): string {
  return renderWarehouseCard(payload, { ...LOCAL_DRAFT, kind: "warehouse_card" }, { local: true, blank });
}

export function downloadWarehouseCardPdfViaPrint(payload: WarehouseCardPayload): boolean {
  return openPrintHtml(warehouseCardHtml(payload));
}

export function downloadWarehouseCardBlankPdfViaPrint(payload: WarehouseCardPayload): boolean {
  return openPrintHtml(warehouseCardHtml(payload, true));
}
