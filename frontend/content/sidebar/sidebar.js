// ============================================================
//  ClickSafe — sidebar.js
//  Loads stats from chrome.storage and populates sidebar UI
// ============================================================

// Get current tab URL and security status
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs[0];
  if (!tab) return;

  const url = tab.url || "";
  const isHttps = url.startsWith("https://");

  // Show URL
  document.getElementById("page-url").textContent = url;

  // Show security badge
  const badge = document.getElementById("page-badge");
  if (isHttps) {
    badge.textContent = "Secure (HTTPS)";
    badge.className = "badge secure";
  } else {
    badge.textContent = "Not Secure (HTTP)";
    badge.className = "badge insecure";
  }
});

// Load stats from chrome.storage
chrome.storage.local.get([
  "lastPageTrackers",
  "totalTrackersFound",
  "totalMixedContent",
  "mixedContentLog"
], function (result) {
  // This page trackers
  const pageTrackers = result.lastPageTrackers || [];
  document.getElementById("stat-trackers").textContent = pageTrackers.length;

  // Mixed content on this page (last entry in log)
  const mixedLog = result.mixedContentLog || [];
  const lastMixed = mixedLog.length > 0 ? mixedLog[mixedLog.length - 1].resources.length : 0;
  document.getElementById("stat-mixed").textContent = lastMixed;

  // Session totals
  document.getElementById("stat-total-trackers").textContent = result.totalTrackersFound || 0;
  document.getElementById("stat-total-mixed").textContent = result.totalMixedContent || 0;
});

// Close button
document.getElementById("close-btn").addEventListener("click", function () {
  window.close();
});

// Settings button
document.getElementById("settings-btn").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/settings/settings.html") });
});