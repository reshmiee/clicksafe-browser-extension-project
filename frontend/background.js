// ============================================================
//  ClickSafe — background.js (Service Worker)
//
//  Responsibilities:
//  1. Icon colour update (HTTPS vs HTTP)
//  2. Message listener
//  3. Download blocker
//  4. Tracker blocklist (Disconnect.me)
//  5. Local Safe Browsing hash prefix store
//  6. Cookie scanning
//  7. Mixed content detection
//  8. Live threat badge + privacy banner
// ============================================================

const BACKEND_URL = "http://localhost:3000";
const SB_REFRESH_MS = 30 * 60 * 1000;


// ============================================================
//  SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
  httpsEnabled:     true,
  cookiesEnabled:   true,
  linksEnabled:     true,
  downloadsEnabled: true,
  modalsEnabled:    true,
  whitelist:        []
};

let currentSettings = { ...DEFAULT_SETTINGS };

chrome.storage.local.get(["settings"], result => {
  if (result.settings) currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
});


// ============================================================
//  COOKIE TRACKER — inlined
// ============================================================

const KNOWN_TRACKER_DOMAINS = [
  'doubleclick.net', 'google-analytics.com', 'googleadservices.com',
  'googlesyndication.com', 'googletagmanager.com', 'facebook.com',
  'facebook.net', 'fbcdn.net', 'adnxs.com', 'adsrvr.org',
  'amazon-adsystem.com', 'criteo.com', 'rubiconproject.com',
  'pubmatic.com', 'openx.net', 'mixpanel.com', 'segment.com',
  'quantserve.com', 'scorecardresearch.com', 'chartbeat.com',
  'hotjar.com', 'twitter.com', 'linkedin.com', 'pinterest.com',
  'snapchat.com', 'tiktok.com', 'addthis.com', 'sharethis.com',
  'outbrain.com', 'taboola.com'
];

function _cleanDomain(domain) { return domain.replace(/^\./, ''); }

function _isKnownCookieTracker(cookieDomain) {
  const cleaned = _cleanDomain(cookieDomain);
  return KNOWN_TRACKER_DOMAINS.some(t => cleaned.includes(t));
}

function _isThirdPartyCookie(cookieDomain, currentDomain) {
  const cookieBase  = _cleanDomain(cookieDomain).split('.').slice(-2).join('.');
  const currentBase = _cleanDomain(currentDomain).split('.').slice(-2).join('.');
  return cookieBase !== currentBase;
}

function _hasLongExpiration(expirationDate) {
  if (!expirationDate) return false;
  return (expirationDate - Date.now() / 1000) > 90 * 24 * 60 * 60;
}

function _analyzeCookie(cookie, currentDomain) {
  const isKnown      = _isKnownCookieTracker(cookie.domain);
  const isThirdParty = _isThirdPartyCookie(cookie.domain, currentDomain);
  const hasLongLife  = _hasLongExpiration(cookie.expirationDate);
  const reasons      = [];

  if (isKnown)      reasons.push('Known tracking domain');
  if (isThirdParty) reasons.push('Third-party cookie');
  if (hasLongLife)  reasons.push('Long expiration (>90 days)');

  return {
    isTracker: isKnown || (isThirdParty && hasLongLife),
    reasons,
    cookie: { name: cookie.name, domain: cookie.domain, expirationDate: cookie.expirationDate }
  };
}

async function scanAllCookiesForUrl(currentUrl, tabId) {
  try {
    if (!currentUrl ||
        currentUrl.startsWith('chrome://') ||
        currentUrl.startsWith('chrome-extension://')) {
      return { error: 'Unsupported URL' };
    }

    const urlObj        = new URL(currentUrl);
    const currentDomain = urlObj.hostname;
    const currentBase   = currentDomain.split('.').slice(-2).join('.');
    const allCookies    = await chrome.cookies.getAll({});

    const pageCookies = allCookies.filter(c => {
      const base = _cleanDomain(c.domain).split('.').slice(-2).join('.');
      return base === currentBase || _isKnownCookieTracker(c.domain);
    });

    const firstPartyCookies = pageCookies.filter(c => {
      const base = _cleanDomain(c.domain).split('.').slice(-2).join('.');
      return base === currentBase;
    });

    const trackingCookies = [];
    for (const cookie of pageCookies) {
      const analysis = _analyzeCookie(cookie, currentDomain);
      if (analysis.isTracker) trackingCookies.push(analysis);
    }

    return {
      pageUrl:         currentUrl,
      pageDomain:      currentDomain,
      timestamp:       new Date().toISOString(),
      totalCookies:    firstPartyCookies.length,
      trackingCookies: trackingCookies.length,
      trackers:        trackingCookies
    };

  } catch (error) {
    console.error('[ClickSafe Cookie] Error:', error);
    return { error: error.message };
  }
}


// ============================================================
//  PRIVACY SCORE
//  Formula: start 100, -30 HTTP, -5×cookies(max30),
//           -4×trackers(max20), -5×mixed(max20), clamp 0-100
// ============================================================

function computePrivacyScore({ isHttps, trackingCookies, trackers, mixedContent }) {
  let score = 100;
  if (!isHttps)      score -= 30;
  score -= Math.min((trackingCookies || 0) * 5, 30);
  score -= Math.min((trackers        || 0) * 4, 20);
  score -= Math.min((mixedContent    || 0) * 5, 20);
  return Math.max(0, Math.min(100, score));
}


// ============================================================
//  LIVE THREAT BADGE
// ============================================================

// FIX F10: Per-tab debounce timers so the privacy banner is shown only after
// all async scans (cookies from background, trackers + mixed content from
// content.js) have had time to land in storage.  1 500 ms covers the gap
// between the cookie scan completing and content.js TRACKERS_DETECTED /
// MIXED_CONTENT_DETECTED messages arriving.
const _bannerTimers = {};

async function updateThreatBadge(tabId) {
  try {
    const data = await chrome.storage.local.get([
      `cookieData_${tabId}`,
      `trackerData_${tabId}`,
      `mixedContent_${tabId}`,
      `tabUrl_${tabId}`
    ]);

    const cookieThreats  = data[`cookieData_${tabId}`]?.trackingCookies || 0;
    const trackerThreats = data[`trackerData_${tabId}`]?.count           || 0;
    const mixedThreats   = data[`mixedContent_${tabId}`]?.count          || 0;
    const tabUrl         = data[`tabUrl_${tabId}`]                       || '';
    const isHttps        = tabUrl.startsWith('https://');
    const total          = cookieThreats + trackerThreats + mixedThreats;

    if (total > 0) {
      chrome.action.setBadgeText({ text: String(total), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#DC2626', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }

    const score = computePrivacyScore({
      isHttps,
      trackingCookies: cookieThreats,
      trackers:        trackerThreats,
      mixedContent:    mixedThreats
    });

    chrome.storage.local.set({ [`privacyScore_${tabId}`]: score });

    // FIX F10: debounce the banner message so all scan results are in storage
    // before we decide whether to show it and what the top reason is.
    clearTimeout(_bannerTimers[tabId]);
    _bannerTimers[tabId] = setTimeout(async () => {
      delete _bannerTimers[tabId];
      try {
        // Re-read storage after debounce so we use the fully-settled values
        const settled = await chrome.storage.local.get([
          `cookieData_${tabId}`,
          `trackerData_${tabId}`,
          `mixedContent_${tabId}`,
          `tabUrl_${tabId}`
        ]);
        const sCookies  = settled[`cookieData_${tabId}`]?.trackingCookies || 0;
        const sTrackers = settled[`trackerData_${tabId}`]?.count           || 0;
        const sMixed    = settled[`mixedContent_${tabId}`]?.count          || 0;
        const sUrl      = settled[`tabUrl_${tabId}`]                       || '';
        const sHttps    = sUrl.startsWith('https://');
        const sTotal    = sCookies + sTrackers + sMixed;
        const sScore    = computePrivacyScore({
          isHttps:        sHttps,
          trackingCookies: sCookies,
          trackers:        sTrackers,
          mixedContent:    sMixed
        });
        // Persist the final settled score
        chrome.storage.local.set({ [`privacyScore_${tabId}`]: sScore });

        if (sScore < 50 && sTotal > 0) {
          let topReason = '';
          if (!sHttps)        topReason = 'This page is not encrypted (HTTP)';
          else if (sCookies)  topReason = `${sCookies} tracking cookie${sCookies > 1 ? 's' : ''} detected`;
          else if (sTrackers) topReason = `${sTrackers} tracker script${sTrackers > 1 ? 's' : ''} detected`;
          else if (sMixed)    topReason = `${sMixed} mixed-content resource${sMixed > 1 ? 's' : ''} loaded`;
          chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_PRIVACY_BANNER', score: sScore, topReason, total: sTotal
          }).catch(() => {});
        } else {
          chrome.tabs.sendMessage(tabId, { type: 'HIDE_PRIVACY_BANNER' }).catch(() => {});
        }
      } catch (_) {}
    }, 1500);

  } catch (e) {
    console.error('[ClickSafe Badge]', e);
  }
}


// ============================================================
//  TRACKER BLOCKLIST (Disconnect.me)
// ============================================================

let trackerSet = new Set();

async function loadTrackerBlocklist() {
  try {
    const bundledRes  = await fetch(chrome.runtime.getURL("data/trackers.json"));
    const bundledList = await bundledRes.json();
    bundledList.forEach(d => trackerSet.add(d));
    console.log(`[ClickSafe] Bundled tracker list: ${trackerSet.size} domains`);
  } catch (err) {
    console.warn("[ClickSafe] Bundled tracker list failed:", err.message);
  }

  try {
    const stored  = await chrome.storage.local.get(["trackerBlocklist", "trackerBlocklistUpdated"]);
    const age     = Date.now() - (stored.trackerBlocklistUpdated || 0);
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (age < ONE_DAY && stored.trackerBlocklist?.length) {
      stored.trackerBlocklist.forEach(d => trackerSet.add(d));
      console.log(`[ClickSafe] Cached live tracker list: ${trackerSet.size} total`);
      return;
    }

    const liveRes = await fetch(
      "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json"
    );
    if (!liveRes.ok) throw new Error(`HTTP ${liveRes.status}`);

    const liveData    = await liveRes.json();
    const liveDomains = [];

    for (const category of Object.values(liveData.categories || {})) {
      for (const service of Object.values(category)) {
        for (const [key, val] of Object.entries(service)) {
          if (key === "homepage") continue;
          if (Array.isArray(val)) {
            val.forEach(d => { trackerSet.add(d); liveDomains.push(d); });
          }
        }
      }
    }

    await chrome.storage.local.set({
      trackerBlocklist:        liveDomains,
      trackerBlocklistUpdated: Date.now()
    });

    console.log(`[ClickSafe] Live Disconnect.me list: ${trackerSet.size} total`);
  } catch (err) {
    console.warn("[ClickSafe] Live tracker fetch failed:", err.message);
  }
}

function isTracker(hostname) {
  if (!hostname) return false;
  if (trackerSet.has(hostname)) return true;
  const parts = hostname.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (trackerSet.has(parts.slice(i).join("."))) return true;
  }
  return false;
}


// ============================================================
//  LOCAL SAFE BROWSING HASH PREFIX STORE
// ============================================================

let sbPrefixStore = new Map();

function canonicaliseUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol + "//" + u.host + u.pathname + (u.search || "")).toLowerCase();
  } catch { return url.toLowerCase(); }
}

function getUrlExpressions(url) {
  try {
    const u    = new URL(url);
    const host = u.hostname;
    const path = u.pathname + (u.search || "");
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    const exprs = new Set();

    if (!isIp) {
      const parts = host.split(".");
      for (let i = Math.max(0, parts.length - 5); i < parts.length - 1; i++) {
        const h = parts.slice(i).join(".");
        exprs.add(h + path);
        exprs.add(h + "/");
      }
    }
    exprs.add(host + path);
    exprs.add(host + "/");
    return [...exprs];
  } catch { return [url]; }
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function checkUrlLocally(url) {
  if (sbPrefixStore.size === 0) return null;
  const canonical   = canonicaliseUrl(url);
  const expressions = getUrlExpressions(canonical);

  for (const expr of expressions) {
    const hash   = await sha256Hex(expr);
    const prefix = hash.substring(0, 8);
    for (const [threatType, prefixes] of sbPrefixStore) {
      if (prefixes.has(prefix)) return { needsConfirmation: true, hash, threatType, url };
    }
  }
  return { safe: true };
}

function applyRemovals(existingSet, removalIndices) {
  if (!removalIndices?.length) return existingSet;
  const sorted = [...existingSet].sort();
  removalIndices.slice().sort((a, b) => b - a)
    .forEach(i => { if (i < sorted.length) sorted.splice(i, 1); });
  return new Set(sorted);
}

async function updateSbPrefixes() {
  try {
    const stored       = await chrome.storage.local.get(["sbClientStates"]);
    const clientStates = stored.sbClientStates || {};

    const response = await fetch(`${BACKEND_URL}/api/sb-prefixes`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ clientStates })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    for (const [threatType, update] of Object.entries(data.prefixes || {})) {
      const { entries, responseType, removals } = update;
      if (responseType === "FULL_UPDATE" || !sbPrefixStore.has(threatType)) {
        sbPrefixStore.set(threatType, new Set(entries));
      } else {
        let existing = sbPrefixStore.get(threatType) || new Set();
        existing = applyRemovals(existing, removals);
        entries.forEach(p => existing.add(p));
        sbPrefixStore.set(threatType, existing);
      }
    }

    const storeable = {};
    for (const [threatType, prefixes] of sbPrefixStore) {
      storeable[threatType] = [...prefixes];
    }
    await chrome.storage.local.set({
      sbPrefixStore:     storeable,
      sbClientStates:    data.clientStates || {},
      sbPrefixesUpdated: Date.now()
    });

    const total = [...sbPrefixStore.values()].reduce((a, s) => a + s.size, 0);
    console.log(`[ClickSafe] SB prefixes: ${total} across ${sbPrefixStore.size} threat types`);

  } catch (err) {
    console.warn("[ClickSafe] SB prefix update failed:", err.message);
  }
}

async function loadSbPrefixesFromStorage() {
  try {
    const stored = await chrome.storage.local.get(["sbPrefixStore", "sbPrefixesUpdated"]);

    if (stored.sbPrefixStore && Object.keys(stored.sbPrefixStore).length > 0) {
      for (const [threatType, prefixes] of Object.entries(stored.sbPrefixStore)) {
        sbPrefixStore.set(threatType, new Set(prefixes));
      }
      const total = [...sbPrefixStore.values()].reduce((a, s) => a + s.size, 0);
      console.log(`[ClickSafe] SB prefixes restored: ${total}`);
      const age = Date.now() - (stored.sbPrefixesUpdated || 0);
      if (age > SB_REFRESH_MS) updateSbPrefixes();
    } else {
      console.log("[ClickSafe] No SB prefixes stored, fetching...");
      updateSbPrefixes();
    }
  } catch (err) {
    console.warn("[ClickSafe] SB restore failed:", err.message);
    updateSbPrefixes();
  }
}


// ============================================================
//  PANEL PAYLOAD — FIX: added totalLinksChecked to keys + return
// ============================================================

async function buildPanelPayload(tabId, tabUrl) {
  const isHttps = (tabUrl || "").startsWith("https://");

  const keys = [
    "totalTrackersFound",
    "totalMixedContent",
    "totalCookieTrackersFound",
    "totalLinksChecked",          // FIX: session links total
    `trackerData_${tabId}`,
    `mixedContent_${tabId}`,
    `cookieData_${tabId}`,
    `privacyScore_${tabId}`,
    `linksChecked_${tabId}`
  ];

  const result = await chrome.storage.local.get(keys);

  return {
    url:              tabUrl || "",
    isHttps,
    score:            result[`privacyScore_${tabId}`],
    pageTrackerCount: result[`trackerData_${tabId}`]?.count || 0,
    pageMixedCount:   result[`mixedContent_${tabId}`]?.count || 0,
    cookieData:       result[`cookieData_${tabId}`] || {},
    linksChecked:     result[`linksChecked_${tabId}`] || 0,
    totalTrackersFound:       result.totalTrackersFound       || 0,
    totalMixedContent:        result.totalMixedContent        || 0,
    totalCookieTrackersFound: result.totalCookieTrackersFound || 0,
    totalLinksChecked:        result.totalLinksChecked        || 0,  // FIX: included in payload
  };
}

async function pushPanelUpdate(tabId, tabUrl) {
  try {
    const payload = await buildPanelPayload(tabId, tabUrl);
    chrome.runtime.sendMessage({ type: "PANEL_UPDATE", payload }).catch(() => {});
  } catch (e) {}
}


// ============================================================
//  STARTUP
// ============================================================

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.warn('[ClickSafe] sidePanel.setPanelBehavior:', err));

loadTrackerBlocklist();
loadSbPrefixesFromStorage();
setInterval(updateSbPrefixes, SB_REFRESH_MS);

// Count HTTPS redirects (when we redirect http→https via rules.json the
// navigation URL will start with https:// but the initiating URL was http://).
// We detect this by watching for completed navigations to https:// where the
// referrer policy suggests a redirect occurred (transition type "server_redirect").
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(details => {
    if (
      details.frameId === 0 &&
      details.url.startsWith("https://") &&
      details.transitionQualifiers &&
      details.transitionQualifiers.includes("server_redirect")
    ) {
      chrome.storage.local.get(['totalHttpsRedirects'], r => {
        chrome.storage.local.set({ totalHttpsRedirects: (r.totalHttpsRedirects || 0) + 1 });
      });
    }
  });
}


// ============================================================
//  TAB LOAD — icon + cookie scan
//  FIX: linksChecked_${tabId} reset on navigation (correct),
//       totalLinksChecked never resets (session accumulator)
// ============================================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  // Reset per-tab data for fresh scan (linksChecked resets per page — correct)
  await chrome.storage.local.remove([
    `cookieData_${tabId}`,
    `trackerData_${tabId}`,
    `mixedContent_${tabId}`,
    `privacyScore_${tabId}`,
    `linksChecked_${tabId}`
  ]);
  chrome.action.setBadgeText({ text: '', tabId });
  chrome.storage.local.set({ [`tabUrl_${tabId}`]: tab.url });

  // Icon colour
  const icon = tab.url.startsWith("https://")
    ? "assets/logo/16.png"
    : tab.url.startsWith("http://")
      ? "assets/logo/16-red.png"
      : null;
  if (icon) chrome.action.setIcon({ tabId, path: { 16: icon } });

  // Cookie scan
  if (currentSettings.cookiesEnabled) {
    try {
      const cookieData = await scanAllCookiesForUrl(tab.url, tabId);
      if (cookieData && !cookieData.error) {
        await chrome.storage.local.set({
          [`cookieData_${tabId}`]: cookieData,
          lastPageTracking:        cookieData.trackers,
          totalCookiesFound:       cookieData.totalCookies
        });

        // FIX F16/F18: persist a timestamped log entry for cookie tracker events
        // so the heatmap (F16) and top-domains chart (F18) have durable data
        // even after the tab is closed (cookieData_* keys are wiped on tab close).
        const stored = await chrome.storage.local.get(['cookieTrackerLog', 'totalCookieTrackersFound']);
        const updates = {
          totalCookieTrackersFound: (stored.totalCookieTrackersFound || 0) + cookieData.trackingCookies
        };
        if (cookieData.trackingCookies > 0) {
          const log = stored.cookieTrackerLog || [];
          log.push({
            pageUrl:   cookieData.pageUrl,
            timestamp: cookieData.timestamp,
            count:     cookieData.trackingCookies,
            trackers:  cookieData.trackers.map(t => ({
              domain: (t.cookie?.domain || '').replace(/^\./, '')
            }))
          });
          // Keep log bounded — drop entries older than 30 days
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          updates.cookieTrackerLog = log.filter(e => new Date(e.timestamp).getTime() > cutoff);
        }
        await chrome.storage.local.set(updates);

        updateThreatBadge(tabId);
        pushPanelUpdate(tabId, tab.url);
      }
    } catch (err) {
      console.error('[ClickSafe Cookie]', err);
    }
  }

  pushPanelUpdate(tabId, tab.url);
});


// ============================================================
//  MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "SETTINGS_UPDATED") {
    currentSettings = { ...DEFAULT_SETTINGS, ...message.settings };
    return;
  }

  if (message.type === "GET_CURRENT_TAB_STATS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      if (!tabs[0]) { sendResponse(null); return; }
      const payload = await buildPanelPayload(tabs[0].id, tabs[0].url);
      sendResponse(payload);
    });
    return true;
  }

  if (message.type === "MIXED_CONTENT_DETECTED") {
    if (!currentSettings.httpsEnabled) return;
    const tabId = sender.tab?.id;
    chrome.storage.local.get(["totalMixedContent", "mixedContentLog"], result => {
      const log = result.mixedContentLog || [];
      log.push(message.data);
      chrome.storage.local.set({
        totalMixedContent:         (result.totalMixedContent || 0) + message.data.resources.length,
        mixedContentLog:           log,
        [`mixedContent_${tabId}`]: { count: message.data.resources.length, resources: message.data.resources }
      }, () => {
        if (tabId) {
          updateThreatBadge(tabId);
          chrome.storage.local.get([`tabUrl_${tabId}`], r => pushPanelUpdate(tabId, r[`tabUrl_${tabId}`] || ""));
        }
      });
    });
    return;
  }

  if (message.type === "TRACKERS_DETECTED") {
    if (!currentSettings.cookiesEnabled) return;
    const tabId = sender.tab?.id ?? null;
    chrome.storage.local.get(["trackerLog", "totalTrackersFound", "tabTrackers"], result => {
      const log         = result.trackerLog  || [];
      const tabTrackers = result.tabTrackers || {};
      log.push(message.data);
      if (tabId !== null) tabTrackers[tabId] = message.data.trackers;
      chrome.storage.local.set({
        trackerLog:               log,
        totalTrackersFound:       (result.totalTrackersFound || 0) + message.data.trackers.length,
        tabTrackers,
        [`trackerData_${tabId}`]: { count: message.data.trackers.length }
      }, () => {
        if (tabId) {
          updateThreatBadge(tabId);
          chrome.storage.local.get([`tabUrl_${tabId}`], r => pushPanelUpdate(tabId, r[`tabUrl_${tabId}`] || ""));
        }
      });
    });
    return;
  }

  if (message.type === "CHECK_TRACKER") {
    sendResponse({ isTracker: isTracker(message.hostname) });
    return true;
  }

  if (message.type === "CHECK_LINK") {
    if (!currentSettings.linksEnabled) { sendResponse({ safe: true }); return true; }

    const senderTabId = sender.tab?.id;

    // FIX: increment BOTH per-tab counter AND session total
    if (senderTabId) {
      chrome.storage.local.get([
        `linksChecked_${senderTabId}`,
        `tabUrl_${senderTabId}`,
        'totalLinksChecked'
      ], r => {
        chrome.storage.local.set({
          [`linksChecked_${senderTabId}`]: (r[`linksChecked_${senderTabId}`] || 0) + 1,
          totalLinksChecked:               (r.totalLinksChecked               || 0) + 1
        }, () => {
          pushPanelUpdate(senderTabId, r[`tabUrl_${senderTabId}`] || "");
        });
      });
    }

    try {
      const parsed = new URL(message.url);
      if (currentSettings.whitelist.some(e =>
        parsed.hostname === e || parsed.hostname.endsWith("." + e)
      )) {
        sendResponse({ safe: true, source: "whitelist" });
        return true;
      }
    } catch (_) {}

    checkUrlLocally(message.url).then(localResult => {
      if (localResult?.safe === true) {
        sendResponse({ safe: true, source: "local" });
      } else if (localResult?.needsConfirmation) {
        fetch(`${BACKEND_URL}/api/check-link`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: message.url, hash: localResult.hash, threatType: localResult.threatType })
        })
        .then(r => r.json())
        .then(d => {
          if (d && !d.safe) {
            chrome.storage.local.get(['totalThreatsBlocked'], r => {
              chrome.storage.local.set({ totalThreatsBlocked: (r.totalThreatsBlocked || 0) + 1 });
            });
          }
          sendResponse({ ...d, source: "confirmed" });
        })
        .catch(() => sendResponse({ safe: true, threat: "API_UNAVAILABLE", unavailable: true }));
      } else {
        fetch(`${BACKEND_URL}/api/check-link`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: message.url })
        })
        .then(r => r.json())
        .then(d => sendResponse({ ...d, source: "backend" }))
        .catch(() => sendResponse({ safe: true, threat: "API_UNAVAILABLE", unavailable: true }));
      }
    });
    return true;
  }

  if (message.type === "DARK_PATTERNS_DETECTED") {
    chrome.storage.local.get(["darkPatternLog", "totalDarkPatterns"], result => {
      const log = result.darkPatternLog || [];
      log.push(message.data);
      chrome.storage.local.set({
        darkPatternLog:       log,
        totalDarkPatterns:    (result.totalDarkPatterns || 0) + message.data.count,
        lastPageDarkPatterns: message.data.patterns
      });
    });
    return;
  }

});


// ============================================================
//  DOWNLOAD BLOCKER
// ============================================================

chrome.downloads.onCreated.addListener(async downloadItem => {
  if (!currentSettings.downloadsEnabled) return;

  const { url, filename = "", id } = downloadItem;
  chrome.downloads.pause(id);

  try {
    const res  = await fetch(`${BACKEND_URL}/api/check-download`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ url, filename })
    });
    const data = await res.json();

    // Count every download scanned
    chrome.storage.local.get(['totalDownloadsScanned'], r => {
      chrome.storage.local.set({ totalDownloadsScanned: (r.totalDownloadsScanned || 0) + 1 });
    });

    if (data.safe) {
      chrome.downloads.resume(id);
    } else {
      chrome.downloads.cancel(id);
      // Count blocked threats
      chrome.storage.local.get(['totalThreatsBlocked'], r => {
        chrome.storage.local.set({ totalThreatsBlocked: (r.totalThreatsBlocked || 0) + 1 });
      });
      if (currentSettings.modalsEnabled !== false) {
        chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
          if (!tabs[0]) return;
          const tabId = tabs[0].id;
          // FIX F5/F7: ensure the content script is alive before sending.
          // On pages where the content script hasn't loaded yet (e.g. a new tab
          // that was opened just to trigger a download), sendMessage silently
          // fails.  We use scripting.executeScript to inject it first if needed.
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files:  ['content/content.js']
            });
          } catch (_) {
            // Already injected or a chrome:// page — either way proceed
          }
          chrome.tabs.sendMessage(tabId, {
            type: "SHOW_DOWNLOAD_WARNING", url, filename, threat: data.threat
          }).catch(() => {});
        });
      }
    }
  } catch (err) {
    console.error("[ClickSafe Download] check failed, resuming to avoid blocking all downloads:", err.message);
    chrome.downloads.resume(id);
  }
});


// Tab switch — push panel update
chrome.tabs.onActivated.addListener(info => {
  chrome.tabs.get(info.tabId, tab => {
    if (tab?.url) pushPanelUpdate(tab.id, tab.url);
  });
});

// Tab close — clean up per-tab data
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.local.get(["tabTrackers"], result => {
    const tabTrackers = result.tabTrackers || {};
    delete tabTrackers[tabId];
    chrome.storage.local.set({ tabTrackers });
  });
  chrome.storage.local.remove([
    `cookieData_${tabId}`,
    `trackerData_${tabId}`,
    `mixedContent_${tabId}`,
    `tabUrl_${tabId}`,
    `privacyScore_${tabId}`,
    `linksChecked_${tabId}`
  ]);
});

console.log("[ClickSafe] Background service worker started ✅");