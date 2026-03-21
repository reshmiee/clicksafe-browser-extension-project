// ============================================================
//  ClickSafe — services/safeBrowsingService.js
//  Calls Google Safe Browsing API to check if a URL is safe
// ============================================================

const fetch = require("node-fetch");

const API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const API_URL = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;

async function checkUrl(url) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "clicksafe",
          clientVersion: "1.0.0"
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION"
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });

    const data = await response.json();

    // If matches array exists and has items, URL is dangerous
    if (data.matches && data.matches.length > 0) {
      return {
        safe: false,
        threat: data.matches[0].threatType
      };
    }

    // No matches = safe
    return { safe: true };

  } catch (error) {
    console.error("[ClickSafe] Safe Browsing API error:", error.message);
    // If API fails, default to safe (don't block everything)
    return { safe: true };
  }
}

module.exports = { checkUrl };