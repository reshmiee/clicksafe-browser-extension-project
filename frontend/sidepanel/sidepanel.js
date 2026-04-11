// ============================================================
//  ClickSafe — sidepanel.js
//  Runs inside the Chrome Side Panel.
//  Replaces the old sidebar.js popup approach.
//
//  Key difference from the old popup:
//  The side panel stays open across navigations, so we need to
//  listen for tab updates and reload stats automatically
//  instead of only loading once on open.
// ============================================================

const CIRCUMFERENCE = 201.1; // 2π × 32 (matches SVG r="32" in sidepanel.html)

// ── Initial load ─────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]) loadForTab(tabs[0]);
});

// ── Re-load whenever the active tab changes or navigates ─────
chrome.tabs.onActivated.addListener(info => {
  chrome.tabs.get(info.tabId, tab => {
    if (tab) loadForTab(tab);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  // Only update if this is still the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id === tabId) loadForTab(tab);
  });
});


// ── Main load function ───────────────────────────────────────
function loadForTab(tab) {
  const url     = tab.url || "";
  const isHttps = url.startsWith("https://");
  const tabId   = tab.id;

  // Page URL + HTTPS badge
  const urlEl = document.getElementById("page-url");
  if (urlEl) urlEl.textContent = url || "—";

  const badge = document.getElementById("page-badge");
  if (badge) {
    badge.textContent = isHttps ? "Secure (HTTPS)" : "Not Secure (HTTP)";
    badge.className   = "badge " + (isHttps ? "secure" : "insecure");
  }

  loadStats(tabId, isHttps);
}


// ── Privacy score formula — keep in sync with background.js ──
function computePrivacyScore({ isHttps, trackingCookies, trackers, mixedContent }) {
  let score = 100;
  if (!isHttps)      score -= 30;
  score -= Math.min((trackingCookies || 0) * 5, 30);
  score -= Math.min((trackers        || 0) * 4, 20);
  score -= Math.min((mixedContent    || 0) * 5, 20);
  return Math.max(0, Math.min(100, score));
}

function renderGauge(score) {
  const arc     = document.getElementById("gauge-arc");
  const number  = document.getElementById("gauge-number");
  const verdict = document.getElementById("score-verdict");
  const desc    = document.getElementById("score-desc");
  if (!arc) return;

  arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);

  let color, label, description;
  if (score >= 80) {
    color = "#16a34a"; label = "✅ Safe";          description = "This page has good privacy practices.";
  } else if (score >= 50) {
    color = "#d97706"; label = "⚠️ Moderate Risk"; description = "Some trackers or issues were detected.";
  } else {
    color = "#dc2626"; label = "🚨 High Risk";     description = "Significant privacy threats detected.";
  }

  arc.style.stroke    = color;
  number.textContent  = score;
  number.style.color  = color;
  verdict.textContent = label;
  verdict.style.color = color;
  desc.textContent    = description;
}


// ── Load and render all stats for the given tab ──────────────
function loadStats(tabId, isHttps) {
  const keys = [
    "totalTrackersFound",
    "totalMixedContent",
    "totalCookieTrackersFound",
    `trackerData_${tabId}`,
    `mixedContent_${tabId}`,
    `cookieData_${tabId}`,
    `privacyScore_${tabId}`,
    `linksChecked_${tabId}`
  ];

  chrome.storage.local.get(keys, result => {
    const pageTrackerCount = result[`trackerData_${tabId}`]?.count           || 0;
    const pageMixedCount   = result[`mixedContent_${tabId}`]?.count          || 0;
    const cookieData       = result[`cookieData_${tabId}`]                   || {};
    const linksChecked     = result[`linksChecked_${tabId}`]                 || 0;

    // This page stats
    setText("stat-trackers",        pageTrackerCount);
    setText("stat-mixed",           pageMixedCount);
    setText("stat-total-cookies",   cookieData.totalCookies    || 0);
    setText("stat-cookie-trackers", cookieData.trackingCookies || 0);
    setText("stat-links",           linksChecked);

    // Cookie tracker details
    if (cookieData.trackers?.length > 0) {
      displayCookieTrackers(cookieData.trackers);
    } else {
      const section = document.getElementById("cookie-details-section");
      if (section) section.style.display = "none";
    }

    // Privacy score — use background-stored value first, else compute locally
    const storedScore = result[`privacyScore_${tabId}`];
    const score = (storedScore !== undefined)
      ? storedScore
      : computePrivacyScore({
          isHttps:         isHttps ?? document.getElementById("page-url")?.textContent?.startsWith("https://"),
          trackingCookies: cookieData.trackingCookies || 0,
          trackers:        pageTrackerCount,
          mixedContent:    pageMixedCount
        });

    renderGauge(score);

    // Session totals
    setText("stat-total-trackers",       result.totalTrackersFound       || 0);
    setText("stat-total-mixed",          result.totalMixedContent         || 0);
    setText("stat-total-cookie-trackers", result.totalCookieTrackersFound || 0);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function displayCookieTrackers(trackers) {
  const section  = document.getElementById("cookie-details-section");
  const cookieList = document.getElementById("cookie-list");
  if (!section || !cookieList) return;

  section.style.display = "block";

  cookieList.innerHTML = trackers.map(tracker => {
    const cookie  = tracker.cookie;
    const reasons = tracker.reasons || [];
    return `
      <div class="cookie-item">
        <span class="cookie-domain">${cookie.domain}</span>
        <span class="cookie-name">Cookie: ${cookie.name}</span>
        <div class="cookie-reasons">
          ${reasons.map(r => `<span class="reason-tag">${r}</span>`).join("")}
        </div>
      </div>`;
  }).join("");
}


// ── Settings button ──────────────────────────────────────────
document.getElementById("settings-btn")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/settings/settings.html") });
});


// ── Re-poll after 2s to catch async background writes ────────
// (cookie scan and tracker scan run async after page load)
setTimeout(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) loadForTab(tabs[0]);
  });
}, 2000);
