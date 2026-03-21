// ============================================================
//  ClickSafe — background.js (Service Worker)
//  Handles: Auto-HTTPS Redirect, Icon Updates
//  Coming later: Cookie Tracker, Download Blocker
// ============================================================


// ============================================================
//  FEATURE 1: AUTO-HTTPS REDIRECT
//  Intercepts any http:// request and redirects to https://
// ============================================================

chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    // Only redirect main page navigations, not every resource
    if (details.url.startsWith("http://")) {
      const httpsUrl = details.url.replace("http://", "https://");
      console.log(`[ClickSafe] Redirecting to HTTPS: ${httpsUrl}`);
      return { redirectUrl: httpsUrl };
    }
  },
  {
    urls: ["http://*/*"],
    types: ["main_frame"] // Only intercept main page loads, not images/scripts
  },
  ["blocking"]
);


// ============================================================
//  FEATURE 1 (cont): ICON COLOR UPDATE
//  Green icon = HTTPS (secure), Red icon = HTTP (not secure)
// ============================================================

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // Only run when page has fully loaded and has a URL
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.startsWith("https://")) {
      // Secure page — show green icon
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: "assets/logo/16.png"
        }
      });
      console.log("[ClickSafe] Secure page (HTTPS) ✅");
    } else if (tab.url.startsWith("http://")) {
      // Insecure page — show red icon
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: "assets/logo/16-red.png"
        }
      });
      console.log("[ClickSafe] Insecure page (HTTP) ⚠️");
    }
  }
});


// ============================================================
//  FEATURE 2: HTTPS MONITOR (stub — coming next)
//  Will scan pages for mixed content (HTTP resources on HTTPS pages)
// ============================================================

// TODO: Listen for messages from content.js about mixed content


// ============================================================
//  FEATURE 3: COOKIE TRACKER DETECTOR (stub — coming next)
//  Will analyze cookies and detect third-party trackers
// ============================================================

// TODO: chrome.cookies listeners go here


// ============================================================
//  FEATURE 4: LINK HOVER PREVIEW (stub — needs backend first)
// ============================================================

// TODO: Receives messages from content.js, calls backend API


// ============================================================
//  FEATURE 5: SUSPICIOUS DOWNLOAD BLOCKER (stub — needs backend first)
// ============================================================

// TODO: chrome.downloads.onCreated listener goes here


console.log("[ClickSafe] Background service worker started ✅");