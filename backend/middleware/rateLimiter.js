// ============================================================
//  ClickSafe — middleware/rateLimiter.js
//  Limits requests to prevent API abuse
// ============================================================

const rateLimit = require("express-rate-limit");

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Max 100 requests per 15 minutes per IP
  message: {
    error: "Rate limit exceeded. Try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});