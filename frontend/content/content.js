// ============================================================
//  ClickSafe — content.js
//  Injected into every webpage the user visits
//  Handles: HTTPS Monitor, Cookie Tracker Detection,
//           Link Hover Preview, Dark Pattern Detector
// ============================================================


// ============================================================
//  FEATURE 2: HTTPS MONITOR
// ============================================================

function scanForMixedContent() {
  if (window.location.protocol !== "https:") return;

  const mixedResources = [];

  document.querySelectorAll("img[src^='http://']").forEach(el => {
    mixedResources.push({ type: "image", url: el.src });
  });
  document.querySelectorAll("script[src^='http://']").forEach(el => {
    mixedResources.push({ type: "script", url: el.src });
  });
  document.querySelectorAll("iframe[src^='http://']").forEach(el => {
    mixedResources.push({ type: "iframe", url: el.src });
  });
  document.querySelectorAll("link[rel='stylesheet'][href^='http://']").forEach(el => {
    mixedResources.push({ type: "stylesheet", url: el.href });
  });

  if (mixedResources.length > 0) {
    console.log(`[ClickSafe] Mixed content found: ${mixedResources.length} HTTP resource(s) on HTTPS page`);
    console.table(mixedResources);
    chrome.runtime.sendMessage({
      type: "MIXED_CONTENT_DETECTED",
      data: { pageUrl: window.location.href, resources: mixedResources, timestamp: new Date().toISOString() }
    });
  } else {
    console.log("[ClickSafe] No mixed content detected on this page");
  }
}

scanForMixedContent();


// ============================================================
//  FEATURE 3: COOKIE TRACKER DETECTOR
// ============================================================

function scanForTrackingScripts() {
  const knownTrackers = [
    "google-analytics.com", "googletagmanager.com", "facebook.net",
    "facebook.com/tr", "doubleclick.net", "mixpanel.com", "hotjar.com",
    "segment.com", "twitter.com/i/adsct", "linkedin.com/px", "connect.facebook.net"
  ];

  const foundTrackers = [];

  document.querySelectorAll("script[src]").forEach(el => {
    const src = el.src.toLowerCase();
    knownTrackers.forEach(tracker => {
      if (src.includes(tracker)) {
        foundTrackers.push({ tracker, url: el.src });
      }
    });
  });

  if (foundTrackers.length > 0) {
    console.log(`[ClickSafe] Tracking scripts found: ${foundTrackers.length}`);
    console.table(foundTrackers);
    chrome.runtime.sendMessage({
      type: "TRACKERS_DETECTED",
      data: { pageUrl: window.location.href, trackers: foundTrackers, timestamp: new Date().toISOString() }
    });
  } else {
    console.log("[ClickSafe] No tracking scripts detected on this page");
  }
}

scanForTrackingScripts();


// ============================================================
//  FEATURE 4: LINK HOVER PREVIEW
// ============================================================

const checkedUrls = {};

document.querySelectorAll("a[href]").forEach(link => {
  link.addEventListener("mouseenter", function () {
    const url = this.href;
    if (!url || url.startsWith("javascript:") || url.startsWith("#")) return;
    if (checkedUrls[url] === true) return;

    chrome.runtime.sendMessage(
      { type: "CHECK_LINK", url: url },
      function (response) {
        if (response && !response.safe) {
          checkedUrls[url] = false;
          showWarningModal({ type: "link", url, threat: response.threat });
        } else if (response) {
          checkedUrls[url] = true;
        }
      }
    );
  });
});

function showWarningModal({ type, url, threat, filename }) {
  const existing = document.getElementById("clicksafe-modal-overlay");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.innerHTML = `
    <div id="clicksafe-modal-overlay" style="
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, sans-serif;
    ">
      <div style="
        background: white; border-radius: 12px;
        padding: 32px; max-width: 420px; width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">
          ${type === "download" ? "🚨" : "⚠️"}
        </div>
        <h2 style="color: #dc2626; margin: 0 0 8px 0; font-size: 20px;">
          ${type === "download" ? "Dangerous Download Blocked!" : "Dangerous Link Detected!"}
        </h2>
        <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">
          Threat: <strong>${threat}</strong>
        </p>
        <p style="color: #374151; margin: 0 0 24px 0; font-size: 13px; word-break: break-all;">
          ${filename || url}
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="clicksafe-go-back" style="
            background: #16a34a; color: white; border: none;
            padding: 10px 24px; border-radius: 8px;
            font-size: 14px; cursor: pointer; font-weight: bold;
          ">Go Back (Safe)</button>
          <button id="clicksafe-proceed" style="
            background: #f3f4f6; color: #6b7280;
            border: 1px solid #d1d5db; padding: 10px 24px;
            border-radius: 8px; font-size: 14px; cursor: pointer;
          ">Proceed Anyway (Risky)</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  document.getElementById("clicksafe-go-back").addEventListener("click", () => container.remove());
  document.getElementById("clicksafe-proceed").addEventListener("click", () => container.remove());
}

window.clicksafeShowModal = showWarningModal;

chrome.runtime.onMessage.addListener(function (message) {
  if (message.type === "SHOW_DOWNLOAD_WARNING") {
    showWarningModal({
      type: "download",
      url: message.url,
      filename: message.filename,
      threat: message.threat
    });
  }
});


// ============================================================
//  FEATURE 8: DARK PATTERN DETECTOR
//  Detects and highlights manipulative UI on webpages
// ============================================================

const DARK_PATTERNS = {
  fakeUrgency: {
    label: "Fake Urgency",
    color: "#f97316",
    borderColor: "rgba(249,115,22,0.6)",
    bgColor: "rgba(249,115,22,0.08)",
    patterns: [
      /only\s+\d+\s+left/i, /hurry[\s!]/i, /limited\s+time/i,
      /offer\s+expires/i, /selling\s+fast/i, /almost\s+gone/i,
      /\d+\s+people\s+(are\s+)?(viewing|watching)/i, /act\s+now/i,
      /don'?t\s+miss\s+out/i, /last\s+chance/i, /ends\s+soon/i, /today\s+only/i,
    ]
  },
  confirmShaming: {
    label: "Confirm Shaming",
    color: "#ec4899",
    borderColor: "rgba(236,72,153,0.6)",
    bgColor: "rgba(236,72,153,0.08)",
    patterns: [
      /no,?\s+i\s+don'?t\s+want/i, /no\s+thanks,?\s+i\s+(hate|prefer|don'?t)/i,
      /i\s+don'?t\s+want\s+(to\s+)?(save|deals|offers|discount)/i,
      /no\s+thanks,?\s+i'll\s+pay\s+full/i, /i\s+hate\s+saving/i,
      /i\s+prefer\s+to\s+pay\s+more/i,
    ]
  },
  fakeCountdown: {
    label: "Fake Countdown Timer",
    color: "#ef4444",
    borderColor: "rgba(239,68,68,0.6)",
    bgColor: "rgba(239,68,68,0.08)",
    selectors: [
      '[class*="countdown"]', '[class*="timer"]',
      '[id*="countdown"]', '[id*="timer"]',
      '[class*="count-down"]', '[class*="time-left"]',
    ]
  },
  preTickedCheckbox: {
    label: "Pre-ticked Checkbox",
    color: "#8b5cf6",
    borderColor: "rgba(139,92,246,0.6)",
    bgColor: "rgba(139,92,246,0.08)",
  },
  cookieManipulation: {
    label: "Cookie Banner Manipulation",
    color: "#06b6d4",
    borderColor: "rgba(6,182,212,0.6)",
    bgColor: "rgba(6,182,212,0.08)",
    acceptPatterns: [/accept\s+all/i, /allow\s+all/i, /agree\s+to\s+all/i, /i\s+accept/i],
    rejectPatterns: [/reject\s+all/i, /decline/i, /refuse/i, /necessary\s+only/i, /manage/i],
  }
};

function runDarkPatternDetector() {
  const detected = [];

  // 1. Fake Urgency + Confirm Shaming — scan text elements
  const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, strong, em, b, label, a, button');
  textElements.forEach(el => {
    if (el.children.length > 3) return;
    const text = el.innerText?.trim();
    if (!text || text.length > 300) return;

    DARK_PATTERNS.fakeUrgency.patterns.forEach(pattern => {
      if (pattern.test(text)) {
        highlightElement(el, DARK_PATTERNS.fakeUrgency);
        detected.push({ type: "Fake Urgency", text: text.substring(0, 80) });
      }
    });

    DARK_PATTERNS.confirmShaming.patterns.forEach(pattern => {
      if (pattern.test(text)) {
        highlightElement(el, DARK_PATTERNS.confirmShaming);
        detected.push({ type: "Confirm Shaming", text: text.substring(0, 80) });
      }
    });
  });

  // 2. Fake Countdown Timers
  DARK_PATTERNS.fakeCountdown.selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (/\d/.test(el.innerText)) {
        highlightElement(el, DARK_PATTERNS.fakeCountdown);
        detected.push({ type: "Fake Countdown Timer", text: el.innerText?.substring(0, 80) });
      }
    });
  });

  // 3. Pre-ticked Checkboxes
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
    const label = findCheckboxLabel(checkbox);
    const labelText = label?.innerText?.toLowerCase() || "";
    const marketingKeywords = [
      "newsletter", "marketing", "promotional", "offers", "updates",
      "emails", "subscribe", "news", "deals", "partner", "third party", "third-party"
    ];
    if (marketingKeywords.some(kw => labelText.includes(kw))) {
      const target = label || checkbox;
      highlightElement(target, DARK_PATTERNS.preTickedCheckbox);
      detected.push({ type: "Pre-ticked Checkbox", text: labelText.substring(0, 80) });
    }
  });

  // 4. Cookie Banner Manipulation
  const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], [class*="cookie"] button, [id*="cookie"] button'));
  let hasAccept = false;
  let hasReject = false;
  let acceptBtn = null;

  allButtons.forEach(btn => {
    const text = btn.innerText?.trim();
    if (!text) return;
    if (DARK_PATTERNS.cookieManipulation.acceptPatterns.some(p => p.test(text))) {
      hasAccept = true;
      acceptBtn = btn;
    }
    if (DARK_PATTERNS.cookieManipulation.rejectPatterns.some(p => p.test(text))) {
      hasReject = true;
    }
  });

  if (hasAccept && !hasReject && acceptBtn) {
    highlightElement(acceptBtn, DARK_PATTERNS.cookieManipulation);
    detected.push({ type: "Cookie Banner Manipulation", text: "Accept button found but no Reject option" });
  }

  // Report
  if (detected.length > 0) {
    console.warn(`[ClickSafe] 🚨 ${detected.length} dark pattern(s) detected!`);
    console.table(detected);
    showDarkPatternBadge(detected.length);
    chrome.runtime.sendMessage({
      type: "DARK_PATTERNS_DETECTED",
      data: { pageUrl: window.location.href, patterns: detected, count: detected.length, timestamp: new Date().toISOString() }
    });
  } else {
    console.log("[ClickSafe] No dark patterns detected on this page");
  }
}

function highlightElement(el, pattern) {
  if (el.dataset.clicksafeHighlighted) return;
  el.dataset.clicksafeHighlighted = "true";

  // Create a wrapper div around the element
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display: inline-block !important;
    border: 3px solid ${pattern.color} !important;
    border-radius: 6px !important;
    padding: 2px !important;
    background: ${pattern.bgColor} !important;
    position: relative !important;
  `;

  // Insert wrapper before element then move element inside
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);

  // Add tooltip
  const tooltip = document.createElement("div");
  tooltip.innerText = `⚠️ ${pattern.label}`;
  tooltip.style.cssText = `
    position: absolute !important;
    top: -24px !important;
    left: 0 !important;
    background: ${pattern.color} !important;
    color: white !important;
    font-size: 11px !important;
    font-weight: bold !important;
    padding: 2px 8px !important;
    border-radius: 4px !important;
    z-index: 2147483647 !important;
    white-space: nowrap !important;
    pointer-events: none !important;
    font-family: Arial, sans-serif !important;
  `;
  wrapper.appendChild(tooltip);
}

function findCheckboxLabel(checkbox) {
  if (checkbox.id) {
    const label = document.querySelector(`label[for="${checkbox.id}"]`);
    if (label) return label;
  }
  const parent = checkbox.closest('label');
  if (parent) return parent;
  const sibling = checkbox.nextElementSibling;
  if (sibling && sibling.tagName === "LABEL") return sibling;
  return null;
}

function showDarkPatternBadge(count) {
  const existing = document.getElementById("clicksafe-dp-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.id = "clicksafe-dp-badge";
  badge.innerHTML = `
    <div style="
      position: fixed; bottom: 24px; right: 24px;
      background: #1a1a2e; border: 1px solid rgba(249,115,22,0.4);
      color: white; padding: 12px 18px; border-radius: 12px;
      font-family: Arial, sans-serif; font-size: 13px; font-weight: bold;
      z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: flex; align-items: center; gap: 10px; cursor: pointer;
    ">
      <span style="font-size:20px;">🚨</span>
      <div>
        <div style="color:#f97316;">${count} Dark Pattern${count > 1 ? 's' : ''} Detected</div>
        <div style="font-weight:normal;font-size:11px;color:#9ca3af;margin-top:2px;">Highlighted on page · Click to dismiss</div>
      </div>
    </div>
  `;

  badge.addEventListener("click", () => badge.remove());
  document.body.appendChild(badge);
  setTimeout(() => badge?.remove(), 8000);
}

// Run on load + after delay for dynamic content
runDarkPatternDetector();
setTimeout(runDarkPatternDetector, 2500);


console.log("[ClickSafe] content.js loaded");