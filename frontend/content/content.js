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
//  FEATURE 4: LINK HOVER PREVIEW (stub — coming after backend)
// ============================================================

// TODO: Add mouseenter listeners on <a> tags here


// ============================================================
//  FEATURE 6: SIDEBAR INJECTION (stub — coming later)
// ============================================================

// TODO: Inject sidebar.html when extension icon is clicked


console.log("[ClickSafe] content.js loaded ✅");