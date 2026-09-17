(() => {
  function relayToPage(payload) {
    try {
      window.postMessage({ source: "VIP_HUNTER_EXTENSION", ...payload }, window.location.origin);
    } catch {}
  }

  function sendPreparedQueue(jobs) {
    chrome.runtime.sendMessage({ type: "VIP_START_PREPARED_QUEUE", jobs }, (response) => {
      if (chrome.runtime.lastError) {
        relayToPage({
          type: "VIP_PREPARED_QUEUE_STARTED",
          total: 0,
          error: "Extension queue could not start. Reload the extension and VIP-Hunter page.",
        });
        return;
      }
      relayToPage({
        type: "VIP_PREPARED_QUEUE_STARTED",
        total: Number(response?.total || 0),
        error: response?.error || "",
      });
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.source !== "VIP_HUNTER_WEB") return;

    if (event.data.type === "VIP_EXTENSION_PING") {
      relayToPage({ type: "VIP_EXTENSION_READY" });
      return;
    }

    if (event.data.type === "VIP_START_PREPARED_QUEUE") {
      const jobs = Array.isArray(event.data.jobs) ? event.data.jobs : [];
      sendPreparedQueue(jobs);
    }
  });

  function buildPanel() {
    if (document.getElementById("vip-hunter-autoapply-panel")) return;

    const panel = document.createElement("div");
    panel.id = "vip-hunter-autoapply-panel";
    panel.innerHTML = `
      <div style="font-weight:900;font-size:13px;margin-bottom:3px">VIP-Hunter Auto Apply</div>
      <div id="vip-auto-status" style="font-size:11px;opacity:.78;line-height:1.4">Ready for JD-tailored applications.</div>
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
        <button id="vip-auto-start" style="border:0;border-radius:8px;padding:8px 10px;background:#64e9a4;color:#082116;font-weight:900;cursor:pointer">Tailor + Auto apply</button>
        <button id="vip-auto-skip" style="display:none;border:1px solid #ffffff33;border-radius:8px;padding:8px 10px;background:#ffffff10;color:#fff;font-weight:800;cursor:pointer">Skip current</button>
        <button id="vip-auto-stop" style="border:1px solid #ffffff33;border-radius:8px;padding:8px 10px;background:#ffffff10;color:#fff;font-weight:800;cursor:pointer">Stop</button>
      </div>
    `;
    Object.assign(panel.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      width: "270px",
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

    start.addEventListener("click", () => {
      status.textContent = "Asking VIP-Hunter to select role resumes and tailor them to each JD…";
      relayToPage({ type: "VIP_REQUEST_PREPARED_AUTO_APPLY" });
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
      relayToPage(message);
    });

    chrome.runtime.sendMessage({ type: "VIP_GET_QUEUE_STATUS" }, (response) => {
      if (!response?.ok || response.state === "idle") {
        status.textContent = "Ready. VIP-Hunter will tailor the correct role resume to each JD before applying.";
      } else {
        status.textContent = [`${response.completed}/${response.total} submitted`, response.reason].filter(Boolean).join(" · ");
        skip.style.display = response.state === "paused" ? "inline-block" : "none";
      }
    });

    relayToPage({ type: "VIP_EXTENSION_READY" });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPanel);
  else buildPanel();
})();
