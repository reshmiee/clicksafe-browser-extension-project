// ============================================================
//  ClickSafe — middleware/cors.js
//  Allows requests only from Chrome/Edge/Firefox extensions
// ============================================================

module.exports = function (req, res, next) {
  const origin = req.headers.origin;

  // Only allow real extension origins — reject empty/missing origin
  const allowed =
    origin &&
    (origin.startsWith("chrome-extension://") ||
      origin.startsWith("moz-extension://"));

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return allowed ? res.sendStatus(204) : res.sendStatus(403);
  }

  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: requests must come from the ClickSafe extension" });
  }

  next();
};
