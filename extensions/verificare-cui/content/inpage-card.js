/** Injected on demand via chrome.scripting — no persistent content script registration. */
(function () {
  if (globalThis.__tapseloVerificareCuiInpageLoaded) return;
  globalThis.__tapseloVerificareCuiInpageLoaded = true;

  const HOST_ID = "tapselo-verificare-cui-card-host";

  function getSelectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return { top: 80, left: Math.max(8, window.innerWidth / 2 - 160), width: 0, height: 0, bottom: 100 };
    }
    return rect;
  }

  function removeExisting() {
    document.getElementById(HOST_ID)?.remove();
  }

  function cardStyles() {
    return `
      :host {
        all: initial;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #0f172a;
      }
      .wrap {
        position: fixed;
        z-index: 2147483646;
        width: min(320px, calc(100vw - 16px));
        max-height: min(70vh, 480px);
        overflow: auto;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        box-shadow: 0 10px 40px rgba(15, 23, 42, 0.18);
        padding: 0.65rem 0.75rem 0.75rem;
      }
      .hdr {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .title {
        font-weight: 600;
        font-size: 0.9rem;
        margin: 0;
      }
      .sub {
        font-size: 0.75rem;
        color: #64748b;
        margin: 0.15rem 0 0;
        font-family: ui-monospace, monospace;
      }
      .close {
        border: none;
        background: transparent;
        color: #64748b;
        cursor: pointer;
        font-size: 1.25rem;
        line-height: 1;
        padding: 0 0.15rem;
      }
      .close:hover { color: #0f172a; }
      .err {
        color: #b91c1c;
        font-size: 0.8rem;
        margin: 0;
      }
      .loading {
        color: #64748b;
        font-size: 0.8rem;
        margin: 0;
      }
      dl {
        margin: 0;
        font-size: 0.8rem;
      }
      dt {
        font-weight: 600;
        margin-top: 0.35rem;
      }
      dd {
        margin: 0.1rem 0 0;
        color: #64748b;
      }
      .ftr {
        margin-top: 0.65rem;
        padding-top: 0.5rem;
        border-top: 1px solid #e2e8f0;
        font-size: 0.65rem;
        color: #64748b;
      }
      .ftr a {
        color: #2563eb;
        text-decoration: none;
      }
    `;
  }

  function placeCard(host, rect) {
    const wrap = host.shadowRoot.querySelector(".wrap");
    const margin = 8;
    let top = rect.bottom + margin;
    let left = rect.left;
    const width = wrap.offsetWidth || 320;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) left = margin;
    if (top + wrap.offsetHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - wrap.offsetHeight - margin);
    }
    wrap.style.top = `${top}px`;
    wrap.style.left = `${left}px`;
  }

  function showCard({ cui, error, loading, html }) {
    removeExisting();

    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = cardStyles();
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Verificare CUI ANAF");

    const header = document.createElement("div");
    header.className = "hdr";
    const titles = document.createElement("div");
    const h = document.createElement("p");
    h.className = "title";
    h.textContent = "Verificare CUI ANAF";
    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = cui ? `CUI ${cui}` : "";
    titles.append(h, sub);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "close";
    closeBtn.setAttribute("aria-label", "Închide");
    closeBtn.textContent = "×";

    header.append(titles, closeBtn);
    wrap.append(header);

    const body = document.createElement("div");
    body.className = "body";
    if (loading) {
      const p = document.createElement("p");
      p.className = "loading";
      p.textContent = "Interogăm ANAF…";
      body.append(p);
    } else if (error) {
      const p = document.createElement("p");
      p.className = "err";
      p.textContent = error;
      body.append(p);
    } else if (html) {
      const dl = document.createElement("dl");
      dl.innerHTML = html;
      body.append(dl);
    }
    wrap.append(body);

    const ftr = document.createElement("p");
    ftr.className = "ftr";
    ftr.innerHTML =
      'Date publice ANAF · <a href="https://tapselo.com/extensii/verificare-cui/confidentialitate/" target="_blank" rel="noopener noreferrer">Confidențialitate</a>';
    wrap.append(ftr);

    shadow.append(style, wrap);
    document.documentElement.append(host);

    const rect = getSelectionRect() ?? {
      top: 80,
      left: window.innerWidth / 2 - 160,
      bottom: 100,
      width: 0,
      height: 0,
    };
    requestAnimationFrame(() => placeCard(host, rect));

    function dismiss() {
      removeExisting();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside, true);
    }

    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }

    function onOutside(e) {
      const path = e.composedPath();
      if (!path.includes(host)) dismiss();
    }

    closeBtn.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside, true);
  }

  async function runLookup(cui) {
    showCard({ cui, loading: true });
    try {
      const out = await chrome.runtime.sendMessage({ type: "lookupCui", cui });
      if (!out?.ok) {
        showCard({ cui, error: out?.error ?? "Eroare la interogarea ANAF." });
        return;
      }
      showCard({ cui, html: out.html });
    } catch {
      showCard({ cui, error: "Extensia nu a putut contacta serviciul ANAF." });
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "verificareCuiInpage") return;
    if (msg.error) {
      showCard({ cui: msg.cui ?? "", error: msg.error });
      sendResponse({ ok: true });
      return;
    }
    if (msg.cui) {
      runLookup(msg.cui);
      sendResponse({ ok: true });
    }
    return false;
  });
})();
