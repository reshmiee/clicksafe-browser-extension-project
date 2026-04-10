// ============================================================
//  ClickSafe — controllers/linkController.js
//  Handles link safety check logic.
//
//  Two paths:
//  - hash + threatType provided → full-hash confirmation (local-first flow)
//  - URL only → full URL lookup (fallback flow)
// ============================================================

const { checkUrl, confirmHash } = require("../services/safeBrowsingService");

const ALLOWED_SCHEMES = ["http:", "https:"];
const MAX_URL_LENGTH = 2048;

async function checkLink(req, res, next) {
  try {
    const { url, hash, threatType } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }
    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: "URL exceeds maximum length" });
    }

    let parsed;
    try { parsed = new URL(url); } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return res.status(400).json({ error: `URL scheme '${parsed.protocol}' is not permitted` });
    }

    let result;

    if (hash && threatType) {
      // Local prefix matched — confirm the full hash
      if (!/^[0-9a-f]{64}$/i.test(hash)) {
        return res.status(400).json({ error: "Invalid hash format" });
      }
      result = await confirmHash(hash, threatType);
    } else {
      // No local data — full URL lookup
      result = await checkUrl(url);
    }

    return res.json({
      safe: result.safe,
      url,
      threat: result.threat || null,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
}

module.exports = { checkLink };
