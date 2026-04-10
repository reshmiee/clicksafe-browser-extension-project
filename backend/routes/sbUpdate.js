// ============================================================
//  ClickSafe — routes/sbUpdate.js
//  POST /api/sb-prefixes
// ============================================================

const express = require("express");
const router = express.Router();
const { getSbPrefixes } = require("../controllers/sbUpdateController");

router.post("/sb-prefixes", getSbPrefixes);

module.exports = router;
