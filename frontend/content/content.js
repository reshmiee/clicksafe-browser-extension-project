// ============================================================
//  ClickSafe — content.js
//  Injected into every web page.
//  Handles: HTTPS Monitor, Tracker Detection (blocklist-based),
//           Link Hover Preview (debounced), Dark Pattern Detector,
//           Real-Time Privacy Banner
// ============================================================

// ============================================================
//  FEATURE 1: HTTPS MONITOR
//  Scans the current page for HTTP resources loaded on HTTPS pages
//  (mixed content detection)
// ============================================================

function scanForMixedContent() {
  if (!window.location.href.startsWith("https://")) return;

  const mixedResources = [];

  // Check all images loading over HTTP
  document.querySelectorAll("img[src^='http://']").forEach(el => {
    mixedResources.push({ type: "image", url: el.src });
  });

  // Check all scripts loading over HTTP
  document.querySelectorAll("script[src^='http://']").forEach(el => {
    mixedResources.push({ type: "script", url: el.src });
  });

  // Check all iframes loading over HTTP
  document.querySelectorAll("iframe[src^='http://']").forEach(el => {
    mixedResources.push({ type: "iframe", url: el.src });
  });

  // Check all stylesheets loading over HTTP
  document.querySelectorAll("link[rel='stylesheet'][href^='http://']").forEach(el => {
    mixedResources.push({ type: "stylesheet", url: el.href });
  });

  if (mixedResources.length > 0) {
    console.log(`[ClickSafe] ⚠️ Mixed content found: ${mixedResources.length} HTTP resource(s) on HTTPS page`);
    console.table(mixedResources);

    chrome.runtime.sendMessage({
      type: "MIXED_CONTENT_DETECTED",
      data: {
        pageUrl: window.location.href,
        resources: mixedResources,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    console.log("[ClickSafe] ✅ No mixed content detected on this page");
  }
}

// Run the scan once the page is fully loaded
// content.js runs at document_idle — DOM is ready, call directly
// Wrap in setTimeout(0) so any synchronous page scripts finish first
setTimeout(scanForMixedContent, 0);


// ============================================================
//  FEATURE 2: TRACKER DETECTOR
//  Checks script/resource src domains against the background's
//  loaded Disconnect.me blocklist (~70k entries).
//  No hardcoded list — asks background to do the lookup.
// ============================================================

async function checkHostname(hostname) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "CHECK_TRACKER", hostname }, response => {
      if (chrome.runtime.lastError) { resolve(false); return; }
      resolve(response?.isTracker || false);
    });
  });
}

async function scanForTrackingScripts() {
  const foundTrackers = [];
  const scripts = Array.from(document.querySelectorAll("script[src]"));

  // Check all script srcs in parallel against the blocklist
  await Promise.all(scripts.map(async el => {
    try {
      const hostname = new URL(el.src).hostname;
      const hit = await checkHostname(hostname);
      if (hit) foundTrackers.push({ tracker: hostname, url: el.src });
    } catch (_) {}
  }));

  // Also scan link/image/iframe sources
  const resources = [
    ...Array.from(document.querySelectorAll("img[src]")),
    ...Array.from(document.querySelectorAll("iframe[src]")),
    ...Array.from(document.querySelectorAll("link[href]")),
  ];

  await Promise.all(resources.map(async el => {
    const src = el.src || el.href;
    if (!src) return;
    try {
      const hostname = new URL(src).hostname;
      // Skip same-origin resources — they're not third-party trackers
      if (hostname === window.location.hostname) return;
      const hit = await checkHostname(hostname);
      if (hit) foundTrackers.push({ tracker: hostname, url: src });
    } catch (_) {}
  }));

  if (foundTrackers.length > 0) {
    console.log(`[ClickSafe] 🍪 Tracking scripts found: ${foundTrackers.length}`);
    console.table(foundTrackers);

    chrome.runtime.sendMessage({
      type: "TRACKERS_DETECTED",
      data: {
        pageUrl: window.location.href,
        trackers: foundTrackers,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    console.log("[ClickSafe] ✅ No tracking scripts detected on this page");
  }
}

// Run tracker scan on page load
setTimeout(scanForTrackingScripts, 0);


// ============================================================
//  FEATURE 3: LINK HOVER CHECKER
//  Debounced + pending-guard: at most one in-flight check
//  per URL. Local hash check happens in background.js first —
//  only confirmed threats reach the modal.
// ============================================================

const checkedUrls = {};  // url -> true (safe) | false (unsafe)
const pendingUrls = {};  // url -> true (request in-flight)

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function handleLinkHover(url) {
  if (!url || url.startsWith("javascript:") || url.startsWith("#") || url.startsWith("mailto:")) return;
  if (checkedUrls[url] === true) return;
  if (pendingUrls[url]) return;

  pendingUrls[url] = true;

  chrome.runtime.sendMessage({ type: "CHECK_LINK", url }, function (response) {
    delete pendingUrls[url];
    if (chrome.runtime.lastError) return;
    if (response && !response.safe) {
      checkedUrls[url] = false;
      showWarningModal({ type: "link", url, threat: response.threat });
    } else if (response) {
      // safe: true covers both confirmed-safe AND api-unavailable (unavailable: true)
      // We don't mark unavailable URLs as checked so they get re-tried next hover
      if (!response.unavailable) checkedUrls[url] = true;
    }
  });
}

const debouncedHover = debounce(handleLinkHover, 300);

document.addEventListener("mouseover", function (e) {
  const link = e.target.closest("a[href]");
  if (link) {
    debouncedHover(link.href);
  }
});


// ============================================================
//  FEATURE 4: WARNING MODAL
// ============================================================

function showWarningModal({ type, url, filename, threat }) {
  // Remove existing modal if any
  const existing = document.getElementById("clicksafe-modal-container");
  if (existing) existing.remove();

  // Create modal container
  const container = document.createElement("div");
  container.id = "clicksafe-modal-container";
  container.style.cssText = `
    all: initial;
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  `;

  const target = type === "download" ? (filename || url) : url;
  const icon = type === "download" ? "🚨" : "⚠️";
  const title = type === "download" ? "Dangerous Download Blocked" : "Dangerous Link Detected";

  container.innerHTML = `
    <div style="
      background: white; border-radius: 12px; padding: 28px;
      max-width: 440px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 12px;">${icon}</div>
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #dc2626;">${title}</h2>
      <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">
        Threat: <strong>${threat}</strong>
      </p>
      <p style="margin: 0 0 20px; font-size: 12px; color: #9ca3af; word-break: break-all;">
        ${target}
      </p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="clicksafe-go-back" style="
          background: #dc2626; color: white; border: none;
          padding: 10px 20px; border-radius: 8px; cursor: pointer;
          font-size: 14px; font-weight: 600;
        ">Go Back</button>
        <button id="clicksafe-proceed" style="
          background: #f3f4f6; color: #374151; border: none;
          padding: 10px 20px; border-radius: 8px; cursor: pointer;
          font-size: 14px;
        ">Proceed Anyway</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Button actions
  document.getElementById("clicksafe-go-back").addEventListener("click", () => {
    container.remove();
  });

  document.getElementById("clicksafe-proceed").addEventListener("click", () => {
    container.remove();
  });
}

// Make showWarningModal available globally for background.js messages
console.log("[ClickSafe] content.js loaded ✅");


// ============================================================
//  FEATURE 5: REAL-TIME PRIVACY BANNER
//  Injected into the page when privacy score drops below 50.
//  background.js sends SHOW_PRIVACY_BANNER after every scan.
// ============================================================

const BANNER_ID = 'clicksafe-privacy-banner';

function showPrivacyBanner({ score, topReason, total }) {
  if (document.getElementById(BANNER_ID)) return;

  const isRed    = score < 35;
  const bgColor  = isRed ? '#fef2f2' : '#fffbeb';
  const border   = isRed ? '#fca5a5' : '#fcd34d';
  const iconBg   = isRed ? '#fee2e2' : '#fef3c7';
  const iconText = isRed ? '#dc2626' : '#d97706';
  const text     = isRed ? '#7f1d1d' : '#78350f';
  const label    = isRed ? 'High Risk' : 'Moderate Risk';

  const banner = document.createElement('div');
  banner.id = BANNER_ID;

  banner.style.cssText = `
    all: initial;
    display: block;
    width: 100%;
    box-sizing: border-box;
    background: ${bgColor};
    border-bottom: 1.5px solid ${border};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    z-index: 2147483647;
    position: fixed;
    top: 0;
  `;

  banner.innerHTML = `
    <div style="
      max-width: 900px;
      margin: 0 auto;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    ">
      <div style="
        background: ${iconBg};
        border-radius: 50%;
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        font-size: 16px;
      ">🛡️</div>

      <div style="flex: 1; min-width: 0;">
        <span style="
          font-size: 13px; font-weight: 600;
          color: ${iconText}; margin-right: 8px;
        ">ClickSafe · ${label}</span>
        <span style="font-size: 13px; color: ${text};">
          Privacy score <strong style="color:${iconText};">${score}/100</strong>
          &nbsp;·&nbsp; ${topReason}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <span style="
          font-size: 11px; color: ${text}; opacity: 0.7;
        ">${total} threat${total !== 1 ? 's' : ''} detected</span>

        <button id="clicksafe-banner-dismiss" style="
          background: none; border: 1px solid ${border};
          border-radius: 6px; padding: 4px 10px;
          font-size: 12px; color: ${text};
          cursor: pointer; font-family: inherit;
        ">Dismiss</button>
      </div>
    </div>
  `;

  document.body.insertBefore(banner, document.body.firstChild);

  document.getElementById('clicksafe-banner-dismiss')
    .addEventListener('click', hidePrivacyBanner);
}

function hidePrivacyBanner() {
  const banner = document.getElementById(BANNER_ID);
  if (banner) banner.remove();
}


// ============================================================
//  FEATURE 6: DARK PATTERN DETECTOR
// ============================================================

const DARK_PATTERNS = {
  fakeUrgency: {
    label: "Fake Urgency", color: "#f97316",
    bgColor: "rgba(249,115,22,0.08)",
    patterns: [
      /only\s+\d+\s+left/i, /hurry[\s!]/i, /limited\s+time/i,
      /offer\s+expires/i, /selling\s+fast/i, /almost\s+gone/i,
      /\d+\s+people\s+(are\s+)?(viewing|watching)/i, /act\s+now/i,
      /don'?t\s+miss\s+out/i, /last\s+chance/i, /ends\s+soon/i, /today\s+only/i,
    ]
  },
  confirmShaming: {
    label: "Confirm Shaming", color: "#ec4899",
    bgColor: "rgba(236,72,153,0.08)",
    patterns: [
      /no,?\s+i\s+don'?t\s+want/i, /no\s+thanks,?\s+i\s+(hate|prefer|don'?t)/i,
      /i\s+don'?t\s+want\s+(to\s+)?(save|deals|offers|discount)/i,
      /no\s+thanks,?\s+i'll\s+pay\s+full/i, /i\s+hate\s+saving/i,
      /i\s+prefer\s+to\s+pay\s+more/i,
    ]
  },
  fakeCountdown: {
    label: "Fake Countdown Timer", color: "#ef4444",
    bgColor: "rgba(239,68,68,0.08)",
    selectors: ['[class*="countdown"]','[class*="timer"]','[id*="countdown"]','[id*="timer"]','[class*="count-down"]','[class*="time-left"]']
  },
  preTickedCheckbox: {
    label: "Pre-ticked Checkbox", color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.08)"
  },
  cookieManipulation: {
    label: "Cookie Banner Manipulation", color: "#06b6d4",
    bgColor: "rgba(6,182,212,0.08)",
    acceptPatterns: [/accept\s+all/i, /allow\s+all/i, /agree\s+to\s+all/i, /i\s+accept/i],
    rejectPatterns: [/reject\s+all/i, /decline/i, /refuse/i, /necessary\s+only/i, /manage/i],
  }
};

function runDarkPatternDetector() {
  const detected = [];

  const textEls = document.querySelectorAll("p,span,div,h1,h2,h3,h4,h5,strong,em,b,label,a,button");
  textEls.forEach(el => {
    if (el.children.length > 3) return;
    const text = el.innerText?.trim();
    if (!text || text.length > 300) return;

    DARK_PATTERNS.fakeUrgency.patterns.forEach(p => {
      if (p.test(text)) { highlightElement(el, DARK_PATTERNS.fakeUrgency); detected.push({ type: "Fake Urgency", text: text.substring(0, 80) }); }
    });
    DARK_PATTERNS.confirmShaming.patterns.forEach(p => {
      if (p.test(text)) { highlightElement(el, DARK_PATTERNS.confirmShaming); detected.push({ type: "Confirm Shaming", text: text.substring(0, 80) }); }
    });
  });

  DARK_PATTERNS.fakeCountdown.selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (/\d/.test(el.innerText)) {
        highlightElement(el, DARK_PATTERNS.fakeCountdown);
        detected.push({ type: "Fake Countdown Timer", text: el.innerText?.substring(0, 80) });
      }
    });
  });

  document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
    const label = findCheckboxLabel(cb);
    const labelText = label?.innerText?.toLowerCase() || "";
    const keywords = ["newsletter","marketing","promotional","offers","updates","emails","subscribe","news","deals","partner","third party","third-party"];
    if (keywords.some(kw => labelText.includes(kw))) {
      highlightElement(label || cb, DARK_PATTERNS.preTickedCheckbox);
      detected.push({ type: "Pre-ticked Checkbox", text: labelText.substring(0, 80) });
    }
  });

  const allBtns = Array.from(document.querySelectorAll('button,a[role="button"],[class*="cookie"] button,[id*="cookie"] button'));
  let hasAccept = false, hasReject = false, acceptBtn = null;
  allBtns.forEach(btn => {
    const t = btn.innerText?.trim();
    if (!t) return;
    if (DARK_PATTERNS.cookieManipulation.acceptPatterns.some(p => p.test(t))) { hasAccept = true; acceptBtn = btn; }
    if (DARK_PATTERNS.cookieManipulation.rejectPatterns.some(p => p.test(t))) { hasReject = true; }
  });
  if (hasAccept && !hasReject && acceptBtn) {
    highlightElement(acceptBtn, DARK_PATTERNS.cookieManipulation);
    detected.push({ type: "Cookie Banner Manipulation", text: "Accept button with no Reject option" });
  }

  if (detected.length > 0) {
    showDarkPatternBadge(detected.length);
    chrome.runtime.sendMessage({
      type: "DARK_PATTERNS_DETECTED",
      data: { pageUrl: window.location.href, patterns: detected, count: detected.length, timestamp: new Date().toISOString() }
    });
  }
}

function highlightElement(el, pattern) {
  if (el.dataset.clicksafeHighlighted) return;
  el.dataset.clicksafeHighlighted = "true";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `display:inline-block!important;border:3px solid ${pattern.color}!important;border-radius:6px!important;padding:2px!important;background:${pattern.bgColor}!important;position:relative!important;`;
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
  const tip = document.createElement("div");
  tip.innerText = `⚠️ ${pattern.label}`;
  tip.style.cssText = `position:absolute!important;top:-24px!important;left:0!important;background:${pattern.color}!important;color:white!important;font-size:11px!important;font-weight:bold!important;padding:2px 8px!important;border-radius:4px!important;z-index:2147483647!important;white-space:nowrap!important;pointer-events:none!important;font-family:Arial,sans-serif!important;`;
  wrapper.appendChild(tip);
}

function findCheckboxLabel(cb) {
  if (cb.id) { const l = document.querySelector(`label[for="${cb.id}"]`); if (l) return l; }
  const p = cb.closest("label"); if (p) return p;
  const s = cb.nextElementSibling; if (s?.tagName === "LABEL") return s;
  return null;
}

function showDarkPatternBadge(count) {
  const existing = document.getElementById("clicksafe-dp-badge");
  if (existing) existing.remove();
  const badge = document.createElement("div");
  badge.id = "clicksafe-dp-badge";
  badge.innerHTML = `<div style="position:fixed;bottom:24px;right:24px;background:#1a1a2e;border:1px solid rgba(249,115,22,0.4);color:white;padding:12px 18px;border-radius:12px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;z-index:999999;box-shadow:0 8px 32px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px;cursor:pointer;"><span style="font-size:20px;">🚨</span><div><div style="color:#f97316;">${count} Dark Pattern${count > 1 ? "s" : ""} Detected</div><div style="font-weight:normal;font-size:11px;color:#9ca3af;margin-top:2px;">Highlighted on page · Click to dismiss</div></div></div>`;
  badge.addEventListener("click", () => badge.remove());
  document.body.appendChild(badge);
  setTimeout(() => badge?.remove(), 8000);
}

runDarkPatternDetector();
setTimeout(runDarkPatternDetector, 2500);


// ============================================================
//  MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener(function (message) {
  if (message.type === "SHOW_DOWNLOAD_WARNING") {
    showWarningModal({
      type: "download",
      url: message.url,
      filename: message.filename,
      threat: message.threat
    });
  }

  if (message.type === 'SHOW_PRIVACY_BANNER') {
    showPrivacyBanner({
      score:     message.score,
      topReason: message.topReason,
      total:     message.total
    });
  }

  if (message.type === 'HIDE_PRIVACY_BANNER') {
    hidePrivacyBanner();
  }
});
