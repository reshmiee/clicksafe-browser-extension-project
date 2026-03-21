// ============================================================
//  ClickSafe — middleware/cors.js
//  Allows requests only from the Chrome/Edge extension
// ============================================================

module.exports = function (req, res, next) {
  const origin = req.headers.origin || "";

  // Allow requests from Chrome/Edge extensions and local dev
  const allowed =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin === "http://localhost:3000" ||
    origin === "";

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
};