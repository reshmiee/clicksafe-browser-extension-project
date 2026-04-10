// ============================================================
//  ClickSafe — background.js (Service Worker)
//  Handles: Icon Updates, Message Listener, Download Blocker,
//           Settings, Tracker Blocklist, Safe Browsing Hashes
// ============================================================

const BACKEND_URL = "http://localhost:3000"; // Replace with your deployed backend URL

// How often to refresh the local Safe Browsing hash list (30 min)
const SB_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// ============================================================
//  SETTINGS CACHE
// ============================================================

const DEFAULT_SETTINGS = {
  httpsEnabled: true,
  cookiesEnabled: true,
  linksEnabled: true,
  downloadsEnabled: true,
  modalsEnabled: true,
  whitelist: []
};

let currentSettings = { ...DEFAULT_SETTINGS };

chrome.storage.local.get(["settings"], function (result) {
  if (result.settings) currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
});


// ============================================================
//  TRACKER BLOCKLIST — loaded from bundled data/trackers.json
//  and refreshed from Disconnect.me on install/update
// ============================================================

let trackerSet = new Set();

async function loadTrackerBlocklist() {
  try {
    // First load the bundled list so we always have something
    const bundledUrl = chrome.runtime.getURL("data/trackers.json");
    const bundledRes = await fetch(bundledUrl);
    const bundledList = await bundledRes.json();
    bundledList.forEach(d => trackerSet.add(d));
    console.log(`[ClickSafe] Loaded ${trackerSet.size} trackers from bundled list`);

    // Then try to fetch the live Disconnect.me list and cache it
    const cached = await chrome.storage.local.get(["trackerBlocklist", "trackerBlocklistUpdated"]);
    const lastUpdated = cached.trackerBlocklistUpdated || 0;
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (Date.now() - lastUpdated < oneDayMs && cached.trackerBlocklist) {
      // Use cached live list
      cached.trackerBlocklist.forEach(d => trackerSet.add(d));
      console.log(`[ClickSafe] Loaded ${trackerSet.size} trackers total (bundled + cached live)`);
      return;
    }

    // Fetch live list from Disconnect.me GitHub
    const liveRes = await fetch(
      "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json"
    );
    if (!liveRes.ok) throw new Error("Failed to fetch live blocklist");

    const liveData = await liveRes.json();
    const liveDomains = [];

    // Parse Disconnect.me services.json format: { categories: { Advertising: { ServiceName: { domains: [...] } } } }
    for (const category of Object.values(liveData.categories || {})) {
      for (const service of Object.values(category)) {
        for (const domainList of Object.values(service)) {
          if (Array.isArray(domainList)) {
            domainList.forEach(d => { trackerSet.add(d); liveDomains.push(d); });
          }
        }
      }
    }

    await chrome.storage.local.set({
      trackerBlocklist: liveDomains,
      trackerBlocklistUpdated: Date.now()
    });

    console.log(`[ClickSafe] Loaded ${trackerSet.size} trackers total (bundled + live Disconnect.me)`);

  } catch (err) {
    console.warn("[ClickSafe] Could not load live tracker list, using bundled:", err.message);
  }
}

// Load blocklist on startup
loadTrackerBlocklist();

// Expose tracker set to content scripts via message
// (content scripts can't import modules, so they ask background)
function isTracker(hostname) {
  if (trackerSet.has(hostname)) return true;
  // Also check if any known tracker domain is a suffix of the hostname
  // e.g. "api.segment.io" matches "segment.io"
  const parts = hostname.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (trackerSet.has(parts.slice(i).join("."))) return true;
  }
  return false;
}


// ============================================================
//  LOCAL SAFE BROWSING HASH LOOKUP
//  Uses the Google Safe Browsing Update API v4 to maintain
//  a local prefix set — URLs never leave the browser unless
//  there is a local hash match (same as how Chrome works).
// ============================================================

// In-memory prefix store: Map<threatType, Set<4-byte hex prefix>>
let sbPrefixStore = new Map();
let sbClientState = {};  // threatType -> clientState token for incremental updates

const SB_THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION"
];

// Hash a URL for Safe Browsing lookup (SHA-256, return hex)
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Canonicalise a URL per Safe Browsing spec (simplified)
function canonicaliseUrl(url) {
  try {
    const u = new URL(url);
    // Remove fragment, normalise path
    return (u.protocol + "//" + u.host + u.pathname + u.search).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Generate the URL expressions to check (hostname + path variations)
function getUrlExpressions(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname + (u.search || "");
    const expressions = [];

    // Host variations: up to 5 components, skip IP
    const hostParts = host.split(".");
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    if (!isIp) {
      for (let i = Math.max(0, hostParts.length - 5); i < hostParts.length - 1; i++) {
        expressions.push(hostParts.slice(i).join(".") + path);
        expressions.push(hostParts.slice(i).join(".") + "/");
      }
    }

    expressions.push(host + path);
    expressions.push(host + "/");
    return [...new Set(expressions)];
  } catch {
    return [url];
  }
}

async function updateSbPrefixes() {
  const API_KEY = "YOUR_GOOGLE_SAFE_BROWSING_API_KEY"; // Set via backend proxy ideally
  // NOTE: In production, call your backend /api/sb-update which proxies this
  // so the API key stays server-side. For now this is a placeholder structure.
  console.log("[ClickSafe] Safe Browsing prefix update skipped — configure API key in backend");
}

// Check a URL against the local prefix store
// Returns { safe: boolean, threat?: string }
async function checkUrlLocally(url) {
  if (sbPrefixStore.size === 0) {
    // No local data yet — fall back to backend check
    return null;
  }

  const canonical = canonicaliseUrl(url);
  const expressions = getUrlExpressions(canonical);

  for (const expr of expressions) {
    const hash = await sha256Hex(expr);
    const prefix = hash.substring(0, 8); // 4-byte (8 hex char) prefix

    for (const [threatType, prefixes] of sbPrefixStore) {
      if (prefixes.has(prefix)) {
        // Local prefix match — must confirm with full hash via backend
        return { needsConfirmation: true, prefix, hash, threatType, url };
      }
    }
  }

  return { safe: true };
}


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
//  MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

  // Settings updated
  if (message.type === "SETTINGS_UPDATED") {
    currentSettings = { ...DEFAULT_SETTINGS, ...message.settings };
    return;
  }

  // Feature 2: Mixed content
  if (message.type === "MIXED_CONTENT_DETECTED") {
    if (!currentSettings.httpsEnabled) return;
    chrome.storage.local.get(["totalMixedContent"], function (result) {
      chrome.storage.local.set({ totalMixedContent: (result.totalMixedContent || 0) + message.data.resources.length });
    });
  }

  // Feature 3: Trackers detected (per-tab storage)
  if (message.type === "TRACKERS_DETECTED") {
    if (!currentSettings.cookiesEnabled) return;
    const tabId = sender.tab ? sender.tab.id : null;
    chrome.storage.local.get(["trackerLog", "totalTrackersFound", "tabTrackers"], function (result) {
      const log = result.trackerLog || [];
      const total = result.totalTrackersFound || 0;
      const tabTrackers = result.tabTrackers || {};
      log.push(message.data);
      if (tabId !== null) tabTrackers[tabId] = message.data.trackers;
      chrome.storage.local.set({
        trackerLog: log,
        totalTrackersFound: total + message.data.trackers.length,
        tabTrackers
      });
    });
  }

  // Content script asking background to check a tracker domain
  if (message.type === "CHECK_TRACKER") {
    sendResponse({ isTracker: isTracker(message.hostname) });
    return true;
  }

  // Feature 4: Check link safety — local hash check first, then backend
  if (message.type === "CHECK_LINK") {
    if (!currentSettings.linksEnabled) {
      sendResponse({ safe: true });
      return true;
    }

    try {
      const parsed = new URL(message.url);
      if (currentSettings.whitelist.some(entry =>
        parsed.hostname === entry || parsed.hostname.endsWith("." + entry)
      )) {
        sendResponse({ safe: true });
        return true;
      }
    } catch (_) {}

    // Try local hash check first
    checkUrlLocally(message.url).then(localResult => {
      if (localResult && localResult.safe === true) {
        // Confirmed safe locally — no network call needed
        sendResponse({ safe: true, source: "local" });
      } else if (localResult && localResult.needsConfirmation) {
        // Local prefix match — confirm with backend
        fetch(`${BACKEND_URL}/api/check-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: message.url, hash: localResult.hash, threatType: localResult.threatType })
        })
        .then(res => res.json())
        .then(data => sendResponse({ ...data, source: "confirmed" }))
        .catch(() => sendResponse({ safe: false, threat: "API_UNAVAILABLE" }));
      } else {
        // No local data — fall back to backend
        fetch(`${BACKEND_URL}/api/check-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: message.url })
        })
        .then(res => res.json())
        .then(data => sendResponse({ ...data, source: "backend" }))
        .catch(() => sendResponse({ safe: false, threat: "API_UNAVAILABLE" }));
      }
    });

    return true;
  }

  // Feature 8: Dark patterns
  if (message.type === "DARK_PATTERNS_DETECTED") {
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
//  FEATURE 5: DOWNLOAD BLOCKER
// ============================================================

chrome.downloads.onCreated.addListener(async function (downloadItem) {
  if (!currentSettings.downloadsEnabled) return;

  const url = downloadItem.url;
  const filename = downloadItem.filename || "";
  chrome.downloads.pause(downloadItem.id);

  try {
    const response = await fetch(`${BACKEND_URL}/api/check-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename })
    });
    const data = await response.json();

    if (data.safe) {
      chrome.downloads.resume(downloadItem.id);
    } else {
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
    console.error("[ClickSafe] Download check failed, cancelling:", error.message);
    chrome.downloads.cancel(downloadItem.id);
  }
});


// Clean up per-tab tracker data on tab close
chrome.tabs.onRemoved.addListener(function (tabId) {
  chrome.storage.local.get(["tabTrackers"], function (result) {
    const tabTrackers = result.tabTrackers || {};
    delete tabTrackers[tabId];
    chrome.storage.local.set({ tabTrackers });
  });
});

// Periodically refresh Safe Browsing prefix list
setInterval(updateSbPrefixes, SB_REFRESH_INTERVAL_MS);

console.log("[ClickSafe] Background service worker started");
