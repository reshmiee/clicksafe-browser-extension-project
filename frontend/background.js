// ============================================================
//  ClickSafe — background.js (Service Worker)
//  Handles: Icon Updates, Message Listener, Download Blocker
// ============================================================

const BACKEND_URL = "http://localhost:3000";

// ============================================================
//  FEATURE 1: ICON COLOR UPDATE
// ============================================================

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.startsWith("https://")) {
      chrome.action.setIcon({ tabId, path: { 16: "assets/logo/16.png" } });
    } else if (tab.url.startsWith("http://")) {
      chrome.action.setIcon({ tabId, path: { 16: "assets/logo/16-red.png" } });
    }
  }
});


// ============================================================
//  FEATURES 2, 3, 4, 8: MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

  // Feature 2: Mixed content detected
  if (message.type === "MIXED_CONTENT_DETECTED") {
    console.log(`[ClickSafe] Mixed content on ${message.data.pageUrl}: ${message.data.resources.length} resource(s)`);
    chrome.storage.local.get(["totalMixedContent"], function (result) {
      const total = result.totalMixedContent || 0;
      chrome.storage.local.set({ totalMixedContent: total + message.data.resources.length });
    });
  }

  // Feature 3: Trackers detected
  if (message.type === "TRACKERS_DETECTED") {
    console.log(`[ClickSafe] Trackers on ${message.data.pageUrl}: ${message.data.trackers.length}`);
    chrome.storage.local.get(["trackerLog", "totalTrackersFound"], function (result) {
      const log = result.trackerLog || [];
      const total = result.totalTrackersFound || 0;
      log.push(message.data);
      chrome.storage.local.set({
        trackerLog: log,
        totalTrackersFound: total + message.data.trackers.length,
        lastPageTrackers: message.data.trackers
      });
    });
  }

  // Feature 4: Check link safety
  if (message.type === "CHECK_LINK") {
    fetch(`${BACKEND_URL}/api/check-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: message.url })
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(() => sendResponse({ safe: true }));
    return true;
  }

  // Feature 8: Dark patterns detected
  if (message.type === "DARK_PATTERNS_DETECTED") {
    console.warn(`[ClickSafe] Dark patterns on ${message.data.pageUrl}: ${message.data.count}`);
    chrome.storage.local.get(["darkPatternLog", "totalDarkPatterns"], function (result) {
      const log = result.darkPatternLog || [];
      const total = result.totalDarkPatterns || 0;
      log.push(message.data);
      chrome.storage.local.set({
        darkPatternLog: log,
        totalDarkPatterns: total + message.data.count,
        lastPageDarkPatterns: message.data.patterns
      });
    });
  }

});


// ============================================================
//  FEATURE 5: SUSPICIOUS DOWNLOAD BLOCKER
// ============================================================

chrome.downloads.onCreated.addListener(async function (downloadItem) {
  const url = downloadItem.url;
  const filename = downloadItem.filename || "";

  console.log(`[ClickSafe] Download detected: ${filename || url}`);
  chrome.downloads.pause(downloadItem.id);

  try {
    const response = await fetch(`${BACKEND_URL}/api/check-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename })
    });

    const data = await response.json();

    if (data.safe) {
      console.log(`[ClickSafe] Download is safe, resuming: ${filename}`);
      chrome.downloads.resume(downloadItem.id);
    } else {
      console.warn(`[ClickSafe] Dangerous download blocked! Threat: ${data.threat}`);
      chrome.downloads.cancel(downloadItem.id);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SHOW_DOWNLOAD_WARNING",
            url, filename, threat: data.threat
          });
        }
      });
    }

  } catch (error) {
    console.error("[ClickSafe] Download check failed, resuming:", error.message);
    chrome.downloads.resume(downloadItem.id);
  }
});


console.log("[ClickSafe] Background service worker started");