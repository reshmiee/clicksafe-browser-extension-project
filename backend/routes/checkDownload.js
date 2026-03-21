// ============================================================
//  ClickSafe — routes/checkDownload.js
//  POST /api/check-download
// ============================================================

const express = require("express");
const router = express.Router();
const { checkDownload } = require("../controllers/downloadController");

router.post("/check-download", checkDownload);

module.exports = router;