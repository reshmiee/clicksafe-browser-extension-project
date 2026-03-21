// ============================================================
//  ClickSafe — middleware/errorHandler.js
//  Catches any unhandled errors and returns clean JSON
// ============================================================

module.exports = function (err, req, res, next) {
  console.error("[ClickSafe] Server error:", err.message);
  res.status(500).json({
    error: "Service temporarily unavailable"
  });
};