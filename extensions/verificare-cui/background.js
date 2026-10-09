import { lookupCuiAnaf } from "./lib/anaf.mjs";

const MENU_ID = "tapselo-verificare-cui";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Verifică CUI la ANAF",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText ?? "").trim();
  if (!text) return;
  await chrome.storage.session.set({ pendingCui: text, pendingSource: "context" });
  chrome.action.openPopup?.();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lookupCui") {
    lookupCuiAnaf(msg.cui)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "Eroare la interogarea ANAF." }));
    return true;
  }
  return false;
});
