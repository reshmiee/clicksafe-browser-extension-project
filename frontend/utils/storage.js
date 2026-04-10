// ============================================================
//  ClickSafe — utils/storage.js
//  Typed wrappers around chrome.storage.local
// ============================================================

/**
 * Retrieves the user's saved settings, merged with defaults.
 * @returns {Promise<object>}
 */
function getSettings() {
  const defaults = {
    httpsEnabled: true,
    cookiesEnabled: true,
    linksEnabled: true,
    downloadsEnabled: true,
    modalsEnabled: true,
    whitelist: []
  };

  return new Promise(resolve => {
    chrome.storage.local.get(["settings"], result => {
      resolve({ ...defaults, ...(result.settings || {}) });
    });
  });
}

/**
 * Saves updated settings to chrome.storage.local and notifies background.js.
 * @param {object} settings
 * @returns {Promise<void>}
 */
function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.local.set({ settings }, () => {
      chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings });
      resolve();
    });
  });
}

/**
 * Retrieves session-level stats counters.
 * @returns {Promise<object>}
 */
function getStats() {
  return new Promise(resolve => {
    chrome.storage.local.get([
      "totalTrackersFound",
      "totalMixedContent",
      "totalDarkPatterns"
    ], result => {
      resolve({
        totalTrackers: result.totalTrackersFound || 0,
        totalMixedContent: result.totalMixedContent || 0,
        totalDarkPatterns: result.totalDarkPatterns || 0
      });
    });
  });
}

/**
 * Returns the tracker list for a specific tab ID.
 * @param {number} tabId
 * @returns {Promise<Array>}
 */
function getTrackersForTab(tabId) {
  return new Promise(resolve => {
    chrome.storage.local.get(["tabTrackers"], result => {
      const tabTrackers = result.tabTrackers || {};
      resolve(tabTrackers[tabId] || []);
    });
  });
}
