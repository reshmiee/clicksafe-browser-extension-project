// ============================================================
//  ClickSafe — controllers/downloadController.js
//  Handles download safety check logic
// ============================================================

const { checkUrl } = require("../services/safeBrowsingService");

const ALLOWED_SCHEMES = ["http:", "https:"];
const MAX_URL_LENGTH = 2048;
const MAX_FILENAME_LENGTH = 255;
// Only allow printable ASCII filenames; reject path traversal characters
const SAFE_FILENAME_RE = /^[^/\\:*?"<>|]+$/;

async function checkDownload(req, res, next) {
  try {
    const { url, filename } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: "URL exceeds maximum length" });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return res.status(400).json({ error: `URL scheme '${parsed.protocol}' is not permitted` });
    }

    // Validate filename if provided
    let safeFilename = null;
    if (filename !== undefined && filename !== null) {
      if (typeof filename !== "string" || filename.length > MAX_FILENAME_LENGTH || !SAFE_FILENAME_RE.test(filename)) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      safeFilename = filename;
    }

    const result = await checkUrl(url);

    return res.json({
      safe: result.safe,
      url,
      filename: safeFilename,
      threat: result.threat || null,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
}

module.exports = { checkDownload };
