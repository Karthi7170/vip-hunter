let queue = [];
let total = 0;
let completed = 0;
let activeTabId = null;
let pausedTabId = null;
let activeJob = null;
let running = false;
let lastReason = "";
const processedTabs = new Set();

async function broadcast(state, reason = "", extra = {}) {
  lastReason = reason || lastReason;
  const payload = {
    type: "VIP_QUEUE_STATUS",
    state,
    total,
    completed,
    remaining: queue.length,
    reason: reason || lastReason,
    currentJobId: activeJob?.jobId || "",
    ...extra,
  };

  const tabs = await chrome.tabs.query({ url: "https://vip-hunter.vercel.app/*" });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try { await chrome.tabs.sendMessage(tab.id, payload); } catch {}
  }
}

function validPreparedJob(job) {
  return Boolean(
    job &&
    typeof job.url === "string" &&
    /^https:\/\//i.test(job.url) &&
    typeof job.jobId === "string" &&
    job.resume &&
    typeof job.resume.base64 === "string" &&
    job.resume.base64.length > 100 &&
    typeof job.resume.name === "string"
  );
}

async function openNext() {
  if (!running || activeTabId || pausedTabId) return;

  const next = queue.shift();
  if (!next) {
    running = false;
    activeJob = null;
    await broadcast("complete", completed ? `${completed} application${completed === 1 ? "" : "s"} submitted.` : "Queue finished.");
    return;
  }

  activeJob = next;
  await chrome.storage.local.set({
    vipHunterResume: next.resume,
    vipHunterCurrentJob: {
      jobId: next.jobId,
      company: next.company || "",
      title: next.title || "",
      atsScore: Number(next.atsScore || 0),
      preparedAt: Date.now(),
    },
  });

  const tab = await chrome.tabs.create({ url: next.url, active: false });
  activeTabId = tab.id || null;
  await broadcast(
    "running",
    `Opening ${next.company || "company"} · ${next.title || "application"} with its JD-tailored resume…`,
  );
}

async function finishTab(tabId, reason = "") {
  if (!tabId || processedTabs.has(tabId)) return;
  processedTabs.add(tabId);
  const finishedJob = activeJob;
  completed += 1;

  try { await chrome.tabs.remove(tabId); } catch {}
  if (tabId === activeTabId) activeTabId = null;
  if (tabId === pausedTabId) pausedTabId = null;
  activeJob = null;

  await broadcast(
    "running",
    reason || "Application submitted. Moving to the next job…",
    { jobId: finishedJob?.jobId || "", resultStatus: "submitted" },
  );
  await openNext();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "VIP_START_PREPARED_QUEUE") {
      const jobs = (Array.isArray(message.jobs) ? message.jobs : [])
        .filter(validPreparedJob)
        .slice(0, 20);

      queue = jobs;
      total = jobs.length;
      completed = 0;
      activeTabId = null;
      pausedTabId = null;
      activeJob = null;
      running = jobs.length > 0;
      lastReason = "";
      processedTabs.clear();

      await broadcast(
        jobs.length ? "running" : "idle",
        jobs.length
          ? "JD-tailored Auto Apply queue started."
          : "No prepared applications with tailored resumes were received.",
      );
      await openNext();
      sendResponse({ ok: true, total });
      return;
    }

    if (message?.type === "VIP_START_QUEUE") {
      sendResponse({
        ok: false,
        total: 0,
        error: "VIP-Hunter now requires a JD-tailored resume for every Auto Apply job. Start the queue from the VIP-Hunter dashboard.",
      });
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
        await broadcast(
          "paused",
          message.reason || "This application needs your input before it can continue.",
          { jobId: activeJob?.jobId || "", resultStatus: "action_required" },
        );
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "VIP_SKIP_CURRENT") {
      const tabId = pausedTabId || activeTabId;
      const skippedJob = activeJob;
      pausedTabId = null;
      activeTabId = null;
      activeJob = null;
      if (tabId) {
        processedTabs.add(tabId);
        try { await chrome.tabs.remove(tabId); } catch {}
      }
      await broadcast(
        "running",
        "Skipped the blocked application. Moving to the next job…",
        { jobId: skippedJob?.jobId || "", resultStatus: "action_required" },
      );
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
      activeJob = null;
      for (const tabId of tabIds) {
        try { await chrome.tabs.remove(tabId); } catch {}
      }
      await broadcast("stopped", "Auto-apply queue stopped.");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "VIP_GET_QUEUE_STATUS") {
      sendResponse({
        ok: true,
        state: running ? (pausedTabId ? "paused" : "running") : "idle",
        total,
        completed,
        remaining: queue.length,
        reason: lastReason,
        currentJobId: activeJob?.jobId || "",
      });
      return;
    }
  })().catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));

  return true;
});
