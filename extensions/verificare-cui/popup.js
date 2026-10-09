import { lookupCuiAnaf } from "./lib/anaf.mjs";
import { lookupBarcode } from "./lib/barcode.mjs";
import { companyHtml } from "./lib/labels.mjs";
import { TAPSELO_UTM } from "./lib/constants.mjs";

const $ = (id) => document.getElementById(id);

document.getElementById("tapselo-link").href = TAPSELO_UTM;

for (const btn of document.querySelectorAll(".tab")) {
  btn.addEventListener("click", () => {
    for (const b of document.querySelectorAll(".tab")) {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    }
    const tab = btn.dataset.tab;
    $("panel-cui").classList.toggle("hidden", tab !== "cui");
    $("panel-cui").hidden = tab !== "cui";
    $("panel-barcode").classList.toggle("hidden", tab !== "barcode");
    $("panel-barcode").hidden = tab !== "barcode";
  });
}

function showCuiError(msg) {
  const el = $("cui-err");
  el.textContent = msg;
  el.hidden = !msg;
  $("cui-result").hidden = true;
}

$("cui-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showCuiError("");
  const cui = $("cui-input").value.trim();
  const out = await lookupCuiAnaf(cui);
  if (!out.ok) {
    showCuiError(out.error);
    return;
  }
  $("cui-result").innerHTML = companyHtml(out.company);
  $("cui-result").hidden = false;
});

$("bc-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("bc-err");
  err.hidden = true;
  $("bc-result").hidden = true;
  const out = await lookupBarcode($("bc-input").value.trim());
  if (!out.ok) {
    err.textContent = out.error;
    err.hidden = false;
    return;
  }
  $("bc-result").innerHTML = out.html;
  $("bc-result").hidden = false;
});

chrome.storage.session.get(["pendingCui"], (data) => {
  if (data.pendingCui) {
    $("cui-input").value = data.pendingCui;
    chrome.storage.session.remove(["pendingCui", "pendingSource"]);
    $("cui-form").requestSubmit();
  }
});
