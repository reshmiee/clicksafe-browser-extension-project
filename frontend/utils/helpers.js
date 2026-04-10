// ============================================================
//  ClickSafe — utils/helpers.js
//  Shared utility functions used across the extension
// ============================================================

/**
 * Truncates a URL for display, keeping the hostname visible.
 * @param {string} url
 * @param {number} maxLength
 * @returns {string}
 */
function truncateUrl(url, maxLength = 60) {
  if (!url) return "";
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + "…";
}

/**
 * Returns a human-readable label for a threat type string
 * returned by the Google Safe Browsing API.
 * @param {string} threatType
 * @returns {string}
 */
function formatThreatType(threatType) {
  const labels = {
    MALWARE: "Malware",
    SOCIAL_ENGINEERING: "Phishing / Social Engineering",
    UNWANTED_SOFTWARE: "Unwanted Software",
    POTENTIALLY_HARMFUL_APPLICATION: "Potentially Harmful App",
    API_UNAVAILABLE: "API Unavailable",
    CONFIG_ERROR: "Configuration Error"
  };
  return labels[threatType] || threatType || "Unknown Threat";
}

/**
 * Returns true if a hostname matches a whitelist entry.
 * Supports exact match and subdomain match (e.g. "example.com" matches "sub.example.com").
 * @param {string} hostname
 * @param {string[]} whitelist
 * @returns {boolean}
 */
function isWhitelisted(hostname, whitelist = []) {
  return whitelist.some(entry => hostname === entry || hostname.endsWith("." + entry));
}

/**
 * Formats a timestamp ISO string into a short human-readable time.
 * @param {string} isoString
 * @returns {string}
 */
function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
