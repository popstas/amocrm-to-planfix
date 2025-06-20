const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { processWebhook } = require("./webhookHandler");

const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "webhooks.db");
const MAX_ATTEMPTS = 12;
const DELAY = 1000;

let nextTimer = null;

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Initialize tables
const initSql = `
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checksum TEXT UNIQUE,
  body TEXT,
  created_at INTEGER,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  next_attempt INTEGER
);
CREATE TABLE IF NOT EXISTS processed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checksum TEXT UNIQUE,
  body TEXT,
  created_at INTEGER,
  processed_at INTEGER,
  attempts INTEGER,
  last_error TEXT,
  response TEXT
);
`;
db.exec(initSql);

// Add next_attempt column if this database was created before it existed
const columns = db.prepare("PRAGMA table_info(queue)").all();
if (!columns.find((c) => c.name === "next_attempt")) {
  db.exec("ALTER TABLE queue ADD COLUMN next_attempt INTEGER DEFAULT 0");
}

function checksum(obj) {
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  return crypto.createHash("sha256").update(str).digest("hex");
}

function addWebhook(body) {
  const sum = checksum(body);
  const exists = db
    .prepare(
      "SELECT 1 FROM queue WHERE checksum=? UNION SELECT 1 FROM processed WHERE checksum=?"
    )
    .get(sum, sum);
  if (exists) {
    console.log("Duplicate webhook:", JSON.stringify(body));
    return false; // duplicate
  }
  db.prepare(
    "INSERT INTO queue (checksum, body, created_at, next_attempt) VALUES (?,?,?,?)"
  ).run(sum, JSON.stringify(body), Date.now(), Date.now());
  processQueue().catch((e) => console.error("Queue processing error:", e));
  return true;
}

let processing = false;

function scheduleNext() {
  if (nextTimer) clearTimeout(nextTimer);
  const row = db
    .prepare(
      "SELECT id, next_attempt FROM queue WHERE attempts < ? ORDER BY next_attempt LIMIT 1"
    )
    .get(MAX_ATTEMPTS);
  if (row) {
    const delay = Math.max(0, row.next_attempt - Date.now());
    console.log(
      `Waiting ${Math.round(delay / 1000)} seconds before processing row ${
        row.id
      }...`
    );
    nextTimer = setTimeout(() => {
      nextTimer = null;
      processQueue().catch((e) => console.error("Queue processing error:", e));
    }, delay);
  }
}

async function handleRow(row) {
  try {
    const data = JSON.parse(row.body);
    const response = await processWebhook({ body: data, row });
    db.prepare(
      "INSERT INTO processed (checksum, body, created_at, processed_at, attempts, response) VALUES (?,?,?,?,?,?)"
    ).run(
      row.checksum,
      row.body,
      row.created_at,
      Date.now(),
      row.attempts + 1,
      JSON.stringify(response)
    );
    db.prepare("DELETE FROM queue WHERE id=?").run(row.id);
  } catch (err) {
    const attempts = row.attempts + 1;
    const sleepTime = DELAY * row.attempts ** 3 * 2;
    const nextAttempt = Date.now() + sleepTime;
    console.log(
      `Retrying row ${row.id}: attempts=${attempts - 1}, sleep=${
        sleepTime / 1000
      }s`
    );
    db.prepare(
      "UPDATE queue SET attempts=?, last_error=?, next_attempt=? WHERE id=?"
    ).run(attempts, err.message, nextAttempt, row.id);
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    const queueSize = db
      .prepare("SELECT COUNT(*) as count FROM queue WHERE attempts < ?")
      .get(MAX_ATTEMPTS).count;
    if (queueSize > 1) {
      console.log(`Queue size: ${queueSize}`);
    }

    let row = db
      .prepare(
        "SELECT * FROM queue WHERE attempts < ? AND next_attempt <= ? ORDER BY attempts, created_at LIMIT 1"
      )
      .get(MAX_ATTEMPTS, Date.now());
    while (row) {
      await handleRow(row);
      row = db
        .prepare(
          "SELECT * FROM queue WHERE attempts < ? AND next_attempt <= ? ORDER BY attempts, created_at LIMIT 1"
        )
        .get(MAX_ATTEMPTS, Date.now());
    }
  } finally {
    processing = false;
    scheduleNext();
  }
}

module.exports = { addWebhook, processQueue };
