// ============================================================
//  ClickSafe — utils/api.js
//  Handles all communication between extension and backend API
// ============================================================

const BACKEND_URL = "http://localhost:3000"; // Change to production URL when deployed

// Check if a link is safe
async function checkLink(url) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/check-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("[ClickSafe] Link check failed:", error.message);
    // If backend is unreachable, assume safe (don't block everything)
    return { safe: true };
  }
}

// Check if a download is safe
async function checkDownload(url, filename) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/check-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename })
    });

    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("[ClickSafe] Download check failed:", error.message);
    return { safe: true };
  }
}