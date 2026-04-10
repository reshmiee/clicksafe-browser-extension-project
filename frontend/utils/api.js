// ============================================================
//  ClickSafe — utils/api.js
//  Handles all communication between extension and backend API.
//  Used by background.js via chrome.runtime.sendMessage routing.
// ============================================================

const BACKEND_URL = "http://localhost:3000"; // Replace with your deployed backend URL

/**
 * Checks if a link URL is safe via the ClickSafe backend.
 * Fails closed — returns { safe: false } if the API is unreachable.
 * @param {string} url
 * @returns {Promise<{safe: boolean, threat?: string}>}
 */
async function checkLink(url) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/check-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();

  } catch (error) {
    console.error("[ClickSafe] Link check failed:", error.message);
    return { safe: false, threat: "API_UNAVAILABLE" };
  }
}

/**
 * Checks if a download URL is safe via the ClickSafe backend.
 * Fails closed — returns { safe: false } if the API is unreachable.
 * @param {string} url
 * @param {string} [filename]
 * @returns {Promise<{safe: boolean, threat?: string}>}
 */
async function checkDownload(url, filename) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/check-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();

  } catch (error) {
    console.error("[ClickSafe] Download check failed:", error.message);
    return { safe: false, threat: "API_UNAVAILABLE" };
  }
}
