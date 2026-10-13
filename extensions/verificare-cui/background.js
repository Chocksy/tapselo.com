import { lookupCuiAnaf } from "./lib/anaf.mjs";
import { companyHtml } from "./lib/labels.mjs";
import { extractCuiFromText } from "./lib/extract-cui.mjs";

const MENU_ID = "tapselo-verificare-cui";
const INPAGE_FILE = "content/inpage-card.js";
const MSG_INVALID =
  "Nu am găsit un CUI valid în selecție. Selectează un cod fiscal (cu sau fără RO).";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Verifică CUI la ANAF",
      contexts: ["selection"],
    });
  });
});

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function readSelectionText(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection()?.toString() ?? "",
  });
  return String(result ?? "").trim();
}

async function ensureInpageScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [INPAGE_FILE],
  });
}

async function showInpageCui(tabId, { cui, error }) {
  if (!tabId) return;
  try {
    await ensureInpageScript(tabId);
    await chrome.tabs.sendMessage(tabId, {
      type: "verificareCuiInpage",
      cui,
      error,
    });
  } catch {
    // Restricted pages (chrome://, Web Store, etc.)
  }
}

async function lookupFromSelection(tabId, selectionText) {
  const text = (selectionText ?? "").trim();
  if (!text) {
    await showInpageCui(tabId, { error: MSG_INVALID });
    return;
  }
  const cui = extractCuiFromText(text);
  if (!cui) {
    await showInpageCui(tabId, { error: MSG_INVALID });
    return;
  }
  await showInpageCui(tabId, { cui });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  await lookupFromSelection(tab.id, info.selectionText);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "lookup-selection-cui") return;
  const tabId = await getActiveTabId();
  if (!tabId) return;
  let text = "";
  try {
    text = await readSelectionText(tabId);
  } catch {
    return;
  }
  await lookupFromSelection(tabId, text);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lookupCui") {
    lookupCuiAnaf(msg.cui)
      .then((out) => {
        if (out.ok) {
          sendResponse({ ok: true, company: out.company, html: companyHtml(out.company) });
        } else {
          sendResponse(out);
        }
      })
      .catch(() => sendResponse({ ok: false, error: "Eroare la interogarea ANAF." }));
    return true;
  }
  return false;
});
