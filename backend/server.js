// dotenv MUST be configured before any other require() that reads process.env
require("dotenv").config();

const express = require("express");
const path    = require("path");
const cors    = require("./middleware/cors");
const rateLimiter   = require("./middleware/rateLimiter");
const errorHandler  = require("./middleware/errorHandler");
const checkLinkRoute     = require("./routes/checkLink");
const checkDownloadRoute = require("./routes/checkDownload");
const sbUpdateRoute      = require("./routes/sbUpdate");

const app = express();

app.use(express.json());
app.use(cors);
app.use(rateLimiter);

// ── API routes ──────────────────────────────────────────────
app.use("/api", checkLinkRoute);
app.use("/api", checkDownloadRoute);
app.use("/api", sbUpdateRoute);

// ── Landing page (static files) ─────────────────────────────
const landingPath = path.join(__dirname, "..", "landing-page");
app.use(express.static(landingPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(landingPath, "index.html"));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[ClickSafe] Server running on port ${PORT}`);
  console.log(`[ClickSafe] Landing page → http://localhost:${PORT}/`);
  console.log(`[ClickSafe] API          → http://localhost:${PORT}/api/`);
});
