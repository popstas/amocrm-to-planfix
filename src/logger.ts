import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_DIR = path.join(__dirname, '..', 'data');
const LOG_PATH = path.join(LOG_DIR, 'app.log');

fs.mkdirSync(LOG_DIR, { recursive: true });

export function write(level: string, messages: string[]) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${messages.join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {
    process.stderr.write(`Failed to write log: ${err.message}\n`);
  }
}

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

console.log = (...args) => {
  write('info', args.map(String));
  originalLog(...args);
};

console.error = (...args) => {
  write('error', args.map(String));
  originalError(...args);
};

console.warn = (...args) => {
  write('warn', args.map(String));
  originalWarn(...args);
};

export default { write };
