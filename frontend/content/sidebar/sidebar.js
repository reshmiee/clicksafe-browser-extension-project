// ============================================================
//  ClickSafe — sidebar.js
// ============================================================

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs[0];
  if (!tab) return;

  const url     = tab.url || "";
  const isHttps = url.startsWith("https://");

  document.getElementById("page-url").textContent = url;

  const badge = document.getElementById("page-badge");
  badge.textContent = isHttps ? "Secure (HTTPS)" : "Not Secure (HTTP)";
  badge.className   = "badge " + (isHttps ? "secure" : "insecure");

  loadStats(tab.id);
});

// ============================================================
//  PRIVACY SCORE — same formula as background.js
//  Keep in sync with computePrivacyScore() in background.js
// ============================================================

function computePrivacyScore({ isHttps, trackingCookies, trackers, mixedContent }) {
  let score = 100;
  if (!isHttps)      score -= 30;
  score -= Math.min((trackingCookies || 0) * 5, 30);
  score -= Math.min((trackers        || 0) * 4, 20);
  score -= Math.min((mixedContent    || 0) * 5, 20);
  return Math.max(0, Math.min(100, score));
}

function renderGauge(score) {
  const CIRCUMFERENCE = 213.6; // 2π × 34
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

  arc.style.stroke       = color;
  number.textContent     = score;
  number.style.color     = color;
  verdict.textContent    = label;
  verdict.style.color    = color;
  desc.textContent       = description;
}

// ============================================================
//  LOAD STATS
// ============================================================

function loadStats(tabId) {
  const keys = [
    "totalTrackersFound",
    "totalMixedContent",
    "totalCookieTrackersFound",
  ];

  if (tabId) {
    keys.push(
      `trackerData_${tabId}`,
      `mixedContent_${tabId}`,
      `cookieData_${tabId}`,
      `privacyScore_${tabId}`
    );
  }

  chrome.storage.local.get(keys, function (result) {

    // ── This page ──────────────────────────────────────────

    const pageTrackerCount = result[`trackerData_${tabId}`]?.count           || 0;
    const pageMixedCount   = result[`mixedContent_${tabId}`]?.count          || 0;
    const cookieData       = result[`cookieData_${tabId}`]                   || {};

    document.getElementById("stat-trackers").textContent       = pageTrackerCount;
    document.getElementById("stat-mixed").textContent          = pageMixedCount;
    document.getElementById("stat-total-cookies").textContent  = cookieData.totalCookies    || 0;
    document.getElementById("stat-cookie-trackers").textContent = cookieData.trackingCookies || 0;

    // Links checked — count stored in checkedLinksCount
    chrome.storage.local.get([`linksChecked_${tabId}`], r => {
      const el = document.getElementById("stat-links");
      if (el) el.textContent = r[`linksChecked_${tabId}`] || 0;
    });

    if (cookieData.trackers?.length > 0) {
      displayCookieTrackers(cookieData.trackers);
    }

    // ── Privacy score ──────────────────────────────────────
    // Use background-computed score if available, else compute locally
    const storedScore = result[`privacyScore_${tabId}`];
    const currentUrl  = document.getElementById("page-url").textContent || "";
    const isHttps     = currentUrl.startsWith("https://");

    const score = (storedScore !== undefined)
      ? storedScore
      : computePrivacyScore({
          isHttps,
          trackingCookies: cookieData.trackingCookies || 0,
          trackers:        pageTrackerCount,
          mixedContent:    pageMixedCount
        });

    renderGauge(score);

    // ── Session totals ─────────────────────────────────────
    document.getElementById("stat-total-trackers").textContent       = result.totalTrackersFound       || 0;
    document.getElementById("stat-total-mixed").textContent          = result.totalMixedContent         || 0;
    document.getElementById("stat-total-cookie-trackers").textContent = result.totalCookieTrackersFound || 0;
  });
}

function displayCookieTrackers(trackers) {
  const section = document.getElementById("cookie-details-section");
  if (!section) return;
  section.style.display = "block";

  const cookieList = document.getElementById("cookie-list");
  if (!cookieList) return;

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

// Re-run after 2s to catch async background writes
setTimeout(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) loadStats(tabs[0].id);
  });
}, 2000);

document.getElementById("close-btn").addEventListener("click", () => window.close());

document.getElementById("settings-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/settings/settings.html") });
});
