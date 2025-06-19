const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { processWebhook } = require('./webhookHandler');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'webhooks.db');
const MAX_ATTEMPTS = 5;
const DELAY = 1000;

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
  last_error TEXT
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

function checksum(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

function addWebhook(body) {
  const sum = checksum(body);
  const exists = db.prepare(
    'SELECT 1 FROM queue WHERE checksum=? UNION SELECT 1 FROM processed WHERE checksum=?'
  ).get(sum, sum);
  if (exists) {
    console.log('Duplicate webhook:', body);
    return false; // duplicate
  }
  db.prepare(
    'INSERT INTO queue (checksum, body, created_at) VALUES (?,?,?)'
  ).run(sum, JSON.stringify(body), Date.now());
  processQueue().catch((e) => console.error('Queue processing error:', e));
  return true;
}

let processing = false;
async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    // Log queue size if greater than 1
    const queueSize = db.prepare('SELECT COUNT(*) as count FROM queue WHERE attempts < ?').get(MAX_ATTEMPTS).count;
    if (queueSize > 1) {
      console.log(`Queue size: ${queueSize}`);
    }
    
    let row = db
      .prepare(
        'SELECT * FROM queue WHERE attempts < ? ORDER BY attempts, created_at LIMIT 1'
      )
      .get(MAX_ATTEMPTS);
    while (row) {
      if (row.attempts > 0) {
        const sleepTime = DELAY * (row.attempts ** 2) * 2; // 2, 8, 18, 32, 50
        console.log(`Retrying row ${row.id}: attempts=${row.attempts}, sleep=${sleepTime}ms`);
        await new Promise((r) => setTimeout(r, sleepTime));
      }
      try {
        const data = JSON.parse(row.body);
        const response = await processWebhook({ body: data });
        db.prepare(
          'INSERT INTO processed (checksum, body, created_at, processed_at, attempts, response) VALUES (?,?,?,?,?,?)'
        ).run(
          row.checksum,
          row.body,
          row.created_at,
          Date.now(),
          row.attempts + 1,
          JSON.stringify(response)
        );
        db.prepare('DELETE FROM queue WHERE id=?').run(row.id);
      } catch (err) {
        db.prepare(
          'UPDATE queue SET attempts=attempts+1, last_error=? WHERE id=?'
        ).run(err.message, row.id);
      }
      await new Promise((r) => setTimeout(r, DELAY));
      row = db
        .prepare(
          'SELECT * FROM queue WHERE attempts < ? ORDER BY attempts, created_at LIMIT 1'
        )
        .get(MAX_ATTEMPTS);
    }
  } finally {
    processing = false;
  }
}

module.exports = { addWebhook, processQueue };
