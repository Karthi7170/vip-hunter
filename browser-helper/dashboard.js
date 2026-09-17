(() => {
  const supportedHosts = new Set([
    "jobs.lever.co",
    "boards.greenhouse.io",
    "job-boards.greenhouse.io",
    "job-boards.eu.greenhouse.io",
    "jobs.smartrecruiters.com",
  ]);

  function supported(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return supportedHosts.has(host) || [...supportedHosts].some((domain) => host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  function queueUrls() {
    const urls = [];
    document.querySelectorAll("article").forEach((article) => {
      const scoreText = article.querySelector(".score")?.textContent || "";
      const score = Number(scoreText.match(/(\d{1,3})\s*%/)?.[1] || 0);
      if (score < 75) return;
      const link = [...article.querySelectorAll("a[href]")].find((a) => supported(a.href));
      if (link?.href) urls.push(link.href);
    });

    if (!urls.length) {
      document.querySelectorAll("a[href]").forEach((link) => {
        if (supported(link.href)) urls.push(link.href);
      });
    }

    return [...new Set(urls)].slice(0, 20);
  }

  function buildPanel() {
    if (document.getElementById("vip-hunter-autoapply-panel")) return;

    const panel = document.createElement("div");
    panel.id = "vip-hunter-autoapply-panel";
    panel.innerHTML = `
      <div style="font-weight:900;font-size:13px;margin-bottom:3px">VIP-Hunter Auto Apply</div>
      <div id="vip-auto-status" style="font-size:11px;opacity:.78;line-height:1.4">Scanning supported 75%+ ATS jobs…</div>
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
        <button id="vip-auto-start" style="border:0;border-radius:8px;padding:8px 10px;background:#64e9a4;color:#082116;font-weight:900;cursor:pointer">Auto apply</button>
        <button id="vip-auto-skip" style="display:none;border:1px solid #ffffff33;border-radius:8px;padding:8px 10px;background:#ffffff10;color:#fff;font-weight:800;cursor:pointer">Skip current</button>
        <button id="vip-auto-stop" style="border:1px solid #ffffff33;border-radius:8px;padding:8px 10px;background:#ffffff10;color:#fff;font-weight:800;cursor:pointer">Stop</button>
      </div>
    `;
    Object.assign(panel.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      width: "260px",
      background: "#0b2418",
      color: "white",
      padding: "14px",
      borderRadius: "14px",
      boxShadow: "0 18px 55px rgba(0,0,0,.28)",
      border: "1px solid rgba(255,255,255,.12)",
      fontFamily: "Inter,system-ui,sans-serif",
    });
    document.body.appendChild(panel);

    const status = panel.querySelector("#vip-auto-status");
    const start = panel.querySelector("#vip-auto-start");
    const skip = panel.querySelector("#vip-auto-skip");
    const stop = panel.querySelector("#vip-auto-stop");

    function refreshCount() {
      const urls = queueUrls();
      if (!urls.length) status.textContent = "No supported 75%+ ATS jobs are visible yet. Run the 7-day scan first.";
      else status.textContent = `${urls.length} supported high-fit job${urls.length === 1 ? "" : "s"} ready for auto apply.`;
    }

    start.addEventListener("click", () => {
      const urls = queueUrls();
      if (!urls.length) {
        refreshCount();
        return;
      }
      chrome.runtime.sendMessage({ type: "VIP_START_QUEUE", urls }, (response) => {
        if (chrome.runtime.lastError) {
          status.textContent = "Extension queue could not start. Reload the extension and this page.";
          return;
        }
        status.textContent = response?.total ? `Started ${response.total}-job auto-apply batch.` : "No supported jobs were queued.";
      });
    });

    skip.addEventListener("click", () => chrome.runtime.sendMessage({ type: "VIP_SKIP_CURRENT" }));
    stop.addEventListener("click", () => chrome.runtime.sendMessage({ type: "VIP_STOP_QUEUE" }));

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type !== "VIP_QUEUE_STATUS") return;
      const progress = message.total ? `${message.completed}/${message.total} submitted` : "";
      status.textContent = [progress, message.reason].filter(Boolean).join(" · ");
      skip.style.display = message.state === "paused" ? "inline-block" : "none";
      start.disabled = message.state === "running" || message.state === "paused";
      start.style.opacity = start.disabled ? ".55" : "1";
    });

    chrome.runtime.sendMessage({ type: "VIP_GET_QUEUE_STATUS" }, (response) => {
      if (!response?.ok || response.state === "idle") refreshCount();
      else {
        status.textContent = [`${response.completed}/${response.total} submitted`, response.reason].filter(Boolean).join(" · ");
        skip.style.display = response.state === "paused" ? "inline-block" : "none";
      }
    });

    new MutationObserver(() => {
      if (!start.disabled) refreshCount();
    }).observe(document.body, { childList: true, subtree: true });

    refreshCount();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPanel);
  else buildPanel();
})();
