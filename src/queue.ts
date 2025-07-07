import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';
import type { ProcessWebhook } from './handlers/types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'webhooks.db');

const MAX_ATTEMPTS = config.queue?.max_attempts ?? 12;
const DELAY = config.queue?.start_delay ?? 1000;

let nextTimer: NodeJS.Timeout | null = null;

fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(DB_PATH);

const initSql = `
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checksum TEXT UNIQUE,
  webhook TEXT,
  body TEXT,
  created_at INTEGER,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  next_attempt INTEGER
);
CREATE TABLE IF NOT EXISTS processed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checksum TEXT UNIQUE,
  webhook TEXT,
  body TEXT,
  created_at INTEGER,
  processed_at INTEGER,
  attempts INTEGER,
  last_error TEXT,
  response TEXT
);
`;

db.exec(initSql);

const columns = db.prepare('PRAGMA table_info(queue)').all();
if (!columns.find(c => c.name === 'webhook')) {
  db.exec('ALTER TABLE queue ADD COLUMN webhook TEXT');
}
if (!columns.find(c => c.name === 'next_attempt')) {
  db.exec('ALTER TABLE queue ADD COLUMN next_attempt INTEGER DEFAULT 0');
}

function checksum(obj: any) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function addWebhook(name: string, body: any, retries = 3, interval = 5000) {
  const sum = checksum(name + JSON.stringify(body));
  const exists = db
    .prepare('SELECT 1 FROM queue WHERE checksum=? UNION SELECT 1 FROM processed WHERE checksum=?')
    .get(sum, sum);
  if (exists) {
    console.log('Duplicate webhook:', JSON.stringify(body));
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      db.prepare('INSERT INTO queue (checksum, webhook, body, created_at, next_attempt) VALUES (?,?,?,?,?)')
        .run(sum, name, JSON.stringify(body), Date.now(), Date.now());
      // queue processing is handled by the worker
      return true;
    } catch (err: any) {
      console.error(`Failed to write webhook (attempt ${attempt}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, interval));
      } else {
        throw err;
      }
    }
  }
  return false;
}

let processing = false;

function scheduleNext() {
  if (nextTimer) clearTimeout(nextTimer);
  const row = db
    .prepare('SELECT id, next_attempt FROM queue WHERE attempts < ? ORDER BY next_attempt LIMIT 1')
    .get(MAX_ATTEMPTS);
  if (row) {
    const delay = Math.max(0, row.next_attempt - Date.now());
    console.log(`Waiting ${Math.round(delay / 1000)} seconds before processing row ${row.id}...`);
    nextTimer = setTimeout(() => {
      nextTimer = null;
      processQueue().catch(e => console.error('Queue processing error:', e));
    }, delay);
  } else {
    nextTimer = setTimeout(() => {
      nextTimer = null;
      processQueue().catch(e => console.error('Queue processing error:', e));
    }, 5000);
  }
}

async function getHandler(name: string): Promise<ProcessWebhook> {
  const mod = await import(`./handlers/${name}.js`);
  return mod.processWebhook as ProcessWebhook;
}

async function handleRow(row: any) {
  try {
    const data = JSON.parse(row.body);
    const handler = await getHandler(row.webhook);
    const response = await handler({ body: data }, row);
    db.prepare('INSERT INTO processed (checksum, webhook, body, created_at, processed_at, attempts, response) VALUES (?,?,?,?,?,?,?)')
      .run(row.checksum, row.webhook, row.body, row.created_at, Date.now(), row.attempts + 1, JSON.stringify(response));
    db.prepare('DELETE FROM queue WHERE id=?').run(row.id);
  } catch (err: any) {
    const attempts = row.attempts + 1;
    const sleepTime = DELAY * row.attempts ** 3 * 2;
    const nextAttempt = Date.now() + sleepTime;
    console.error(`Error processing row ${row.id}:`, err.message?.replace(/\n/g, ' '), ", row: ", JSON.stringify(row));
    console.log(`Retrying row ${row.id}: attempts=${attempts - 1}, sleep=${sleepTime / 1000}s`);
    db.prepare('UPDATE queue SET attempts=?, last_error=?, next_attempt=? WHERE id=?')
      .run(attempts, err.message, nextAttempt, row.id);
  }
}

export async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    const queueSize = db.prepare('SELECT COUNT(*) as count FROM queue WHERE attempts < ?').get(MAX_ATTEMPTS).count;
    if (queueSize > 1) {
      console.log(`Queue size: ${queueSize}`);
    }
    let row = db
      .prepare('SELECT * FROM queue WHERE attempts < ? AND next_attempt <= ? ORDER BY attempts, created_at LIMIT 1')
      .get(MAX_ATTEMPTS, Date.now());
    while (row) {
      await handleRow(row);
      row = db
        .prepare('SELECT * FROM queue WHERE attempts < ? AND next_attempt <= ? ORDER BY attempts, created_at LIMIT 1')
        .get(MAX_ATTEMPTS, Date.now());
    }
  } finally {
    processing = false;
    scheduleNext();
  }
}

export default { addWebhook, processQueue };
