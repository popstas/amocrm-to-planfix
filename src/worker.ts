import './logger.js';
import 'dotenv/config';
import { processQueue } from './queue.js';
import { fileURLToPath } from 'url';

export async function start() {
  console.log('Worker started');
  await processQueue();
}

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  start().catch(e => console.error('Worker error:', e));
}
