// ============================================================
//  ClickSafe — routes/checkLink.js
//  POST /api/check-link
// ============================================================

const express = require("express");
const router = express.Router();
const { checkLink } = require("../controllers/linkController");

router.post("/check-link", checkLink);

module.exports = router;