// ============================================================
//  ClickSafe — sidepanel.js
//
//  ARCHITECTURE:
//  The side panel NEVER queries tabs or listens to tab events
//  directly — those APIs are unreliable inside a panel page.
//
//  Instead:
//  - background.js owns all tab watching (onActivated, onUpdated)
//  - When a tab changes or finishes loading, background.js sends
//    a PANEL_UPDATE message with the full stats payload
//  - sidepanel.js only listens for that message and renders
//  - On first open, sidepanel.js asks background.js for the
//    current tab's stats via GET_CURRENT_TAB_STATS
// ============================================================

const CIRCUMFERENCE = 201.1; // 2π × 32

// ── On open: ask background for current tab stats immediately ─
chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB_STATS" }, response => {
  if (chrome.runtime.lastError) return;
  if (response) render(response);
});

// ── Listen for push updates from background.js ───────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PANEL_UPDATE") {
    render(message.payload);
  }
});


// ── Render all stats from a payload object ───────────────────
function render(payload) {
  if (!payload) return;

  const {
    url = "",
    isHttps = false,
    score,
    pageTrackerCount        = 0,
    pageMixedCount          = 0,
    cookieData              = {},
    linksChecked            = 0,
    totalTrackersFound      = 0,
    totalMixedContent       = 0,
    totalCookieTrackersFound = 0,
    totalLinksChecked       = 0,   // NEW: session total links
  } = payload;

  // URL + HTTPS badge
  setText("page-url", url || "—");
  const badge = document.getElementById("page-badge");
  if (badge) {
    badge.textContent = isHttps ? "Secure (HTTPS)" : "Not Secure (HTTP)";
    badge.className   = "badge " + (isHttps ? "secure" : "insecure");
  }

  // This page stats
  setText("stat-trackers",         pageTrackerCount);
  setText("stat-mixed",            pageMixedCount);
  setText("stat-total-cookies",    cookieData.totalCookies    || 0);
  setText("stat-cookie-trackers",  cookieData.trackingCookies || 0);
  setText("stat-links",            linksChecked);

  // Cookie tracker details
  if (cookieData.trackers?.length > 0) {
    displayCookieTrackers(cookieData.trackers);
  } else {
    const section = document.getElementById("cookie-details-section");
    if (section) section.style.display = "none";
  }

  // Privacy score gauge
  const finalScore = (score !== undefined) ? score : computePrivacyScore({
    isHttps,
    trackingCookies: cookieData.trackingCookies || 0,
    trackers:        pageTrackerCount,
    mixedContent:    pageMixedCount
  });
  renderGauge(finalScore);

  // Session totals — now includes tracker scripts + links checked
  setText("stat-total-cookie-trackers", totalCookieTrackersFound);
  setText("stat-total-trackers",        totalTrackersFound);
  setText("stat-total-mixed",           totalMixedContent);
  setText("stat-total-links",           totalLinksChecked);  // NEW
}


// ── Privacy score formula (keep in sync with background.js) ──
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function displayCookieTrackers(trackers) {
  const section    = document.getElementById("cookie-details-section");
  const cookieList = document.getElementById("cookie-list");
  if (!section || !cookieList) return;

  section.style.display = "block";
  cookieList.innerHTML  = trackers.map(tracker => {
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

// Settings button
document.getElementById("settings-btn")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/settings/settings.html") });
});