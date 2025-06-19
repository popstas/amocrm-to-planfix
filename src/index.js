require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { addWebhook, processQueue } = require("./queue");

// Prevent the process from crashing on unexpected errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

const app = express();
const PORT = process.env.PORT || 3012;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || "/webhook";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "AMOCRM to Planfix webhook server is running",
  });
});

// Webhook endpoint
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    addWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error queueing webhook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
  });
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log("Environment:", process.env.NODE_ENV || "development");
    processQueue().catch((e) => console.error('Startup queue error:', e));
  });
}

module.exports = app; // for testing
