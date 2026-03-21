// ============================================================
//  ClickSafe — content.js
//  Injected into every webpage the user visits
//  Handles: HTTPS Monitor, Cookie Tracker Detection (via messaging)
//  Coming later: Link Hover Preview, Sidebar injection
// ============================================================


// ============================================================
//  FEATURE 2: HTTPS MONITOR
//  Scans the current page for HTTP resources loaded on HTTPS pages
//  (mixed content detection)
// ============================================================

function scanForMixedContent() {
  // Only run this check if the current page is HTTPS
  if (window.location.protocol !== "https:") return;

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

    // Send mixed content data to background.js for storage
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
scanForMixedContent();


// ============================================================
//  FEATURE 3: COOKIE TRACKER DETECTOR
//  Scans page for known tracking scripts in <script> tags
// ============================================================

function scanForTrackingScripts() {
  // Known tracker domains to look for
  const knownTrackers = [
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.net",
    "facebook.com/tr",
    "doubleclick.net",
    "mixpanel.com",
    "hotjar.com",
    "segment.com",
    "twitter.com/i/adsct",
    "linkedin.com/px",
    "connect.facebook.net"
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
    console.log(`[ClickSafe] 🍪 Tracking scripts found: ${foundTrackers.length}`);
    console.table(foundTrackers);

    // Send to background.js for storage
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
scanForTrackingScripts();

// ============================================================
//  FEATURE 4: LINK HOVER PREVIEW
//  Checks every link on hover against backend API
// ============================================================


// Keep track of checked URLs to avoid duplicate API calls
const checkedUrls = {};

document.querySelectorAll("a[href]").forEach(link => {
  link.addEventListener("mouseenter", function () {
    const url = this.href;

    if (!url || url.startsWith("javascript:") || url.startsWith("#")) return;
    if (checkedUrls[url] === true) return;

    // Send to background.js to check (avoids CORS)
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
  // Remove existing modal if any
  const existing = document.getElementById("clicksafe-modal-overlay");
  if (existing) existing.remove();

  // Create modal container
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

  // Button actions
  document.getElementById("clicksafe-go-back").addEventListener("click", () => {
    container.remove();
  });

  document.getElementById("clicksafe-proceed").addEventListener("click", () => {
    container.remove();
  });
}

// Make showWarningModal available globally for background.js messages
window.clicksafeShowModal = showWarningModal;

// Listen for download warning from background.js
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
//  FEATURE 6: SIDEBAR INJECTION (stub — coming later)
// ============================================================

// TODO: Inject sidebar.html when extension icon is clicked


console.log("[ClickSafe] content.js loaded ✅");