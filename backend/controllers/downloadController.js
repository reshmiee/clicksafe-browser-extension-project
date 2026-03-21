// ============================================================
//  ClickSafe — controllers/downloadController.js
//  Handles download safety check logic
// ============================================================

const { checkUrl } = require("../services/safeBrowsingService");

async function checkDownload(req, res, next) {
  try {
    const { url, filename } = req.body;

    // Validate URL exists in request
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Basic URL format validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    console.log(`[ClickSafe] Checking download: ${filename || url}`);

    // Call Google Safe Browsing API
    const result = await checkUrl(url);

    // Return result to extension
    return res.json({
      safe: result.safe,
      url: url,
      filename: filename || null,
      threat: result.threat || null,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
}

module.exports = { checkDownload };