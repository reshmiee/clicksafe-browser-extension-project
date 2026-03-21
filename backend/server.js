const express = require("express");
const cors = require("./middleware/cors");
const rateLimiter = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const checkLinkRoute = require("./routes/checkLink");
const checkDownloadRoute = require("./routes/checkDownload");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors);
app.use(rateLimiter);

app.use("/api", checkLinkRoute);
app.use("/api", checkDownloadRoute);

app.get("/", (req, res) => {
  res.json({ status: "ClickSafe API is running ✅" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ClickSafe] Server running on port ${PORT} ✅`);
});