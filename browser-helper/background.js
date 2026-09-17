let queue = [];
let total = 0;
let completed = 0;
let activeTabId = null;
let pausedTabId = null;
let running = false;
let lastReason = "";
const processedTabs = new Set();

async function broadcast(state, reason = "") {
  lastReason = reason || lastReason;
  const payload = {
    type: "VIP_QUEUE_STATUS",
    state,
    total,
    completed,
    remaining: queue.length,
    reason: reason || lastReason,
  };

  const tabs = await chrome.tabs.query({ url: "https://vip-hunter.vercel.app/*" });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try { await chrome.tabs.sendMessage(tab.id, payload); } catch {}
  }
}

async function openNext() {
  if (!running || activeTabId || pausedTabId) return;

  const next = queue.shift();
  if (!next) {
    running = false;
    await broadcast("complete", completed ? `${completed} application${completed === 1 ? "" : "s"} submitted.` : "Queue finished.");
    return;
  }

  const tab = await chrome.tabs.create({ url: next, active: false });
  activeTabId = tab.id || null;
  await broadcast("running", "Opening the next supported ATS application…");
}

async function finishTab(tabId, reason = "") {
  if (!tabId || processedTabs.has(tabId)) return;
  processedTabs.add(tabId);
  completed += 1;

  try { await chrome.tabs.remove(tabId); } catch {}
  if (tabId === activeTabId) activeTabId = null;
  if (tabId === pausedTabId) pausedTabId = null;

  await broadcast("running", reason || "Application submitted. Moving to the next job…");
  await openNext();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "VIP_START_QUEUE") {
      const urls = [...new Set((message.urls || []).filter((url) => typeof url === "string"))].slice(0, 20);
      queue = urls;
      total = urls.length;
      completed = 0;
      activeTabId = null;
      pausedTabId = null;
      running = urls.length > 0;
      lastReason = "";
      processedTabs.clear();
      await broadcast(urls.length ? "running" : "idle", urls.length ? "Auto-apply queue started." : "No supported 75%+ jobs found on this page.");
      await openNext();
      sendResponse({ ok: true, total });
      return;
    }

    if (message?.type === "VIP_APPLY_RESULT") {
      const tabId = sender.tab?.id || null;
      if (message.status === "submitted") {
        await finishTab(tabId, message.reason || "Application submitted.");
      } else if (message.status === "action_required" && tabId && !processedTabs.has(tabId)) {
        if (tabId === activeTabId) activeTabId = null;
        pausedTabId = tabId;
        running = true;
        await broadcast("paused", message.reason || "This application needs your input before it can continue.");
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "VIP_SKIP_CURRENT") {
      const tabId = pausedTabId || activeTabId;
      pausedTabId = null;
      activeTabId = null;
      if (tabId) {
        processedTabs.add(tabId);
        try { await chrome.tabs.remove(tabId); } catch {}
      }
      await broadcast("running", "Skipped the blocked application. Moving to the next job…");
      await openNext();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "VIP_STOP_QUEUE") {
      queue = [];
      running = false;
      const tabIds = [activeTabId, pausedTabId].filter(Boolean);
      activeTabId = null;
      pausedTabId = null;
      for (const tabId of tabIds) {
        try { await chrome.tabs.remove(tabId); } catch {}
      }
      await broadcast("stopped", "Auto-apply queue stopped.");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "VIP_GET_QUEUE_STATUS") {
      sendResponse({ ok: true, state: running ? (pausedTabId ? "paused" : "running") : "idle", total, completed, remaining: queue.length, reason: lastReason });
      return;
    }
  })().catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));

  return true;
});
