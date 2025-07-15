import './logger.js';
import 'dotenv/config';
import { processQueue } from './queue.js';
import { config } from './config.js';
import { fileURLToPath } from 'url';

function validateTargetConfig() {
  const url = config.planfix_agent?.url;
  const token = config.planfix_agent?.token;
  if (!url || !token) {
    console.error('Missing planfix_agent.url or planfix_agent.token');
    process.exit(1);
  }
}

export async function start() {
  console.log('Worker started');
  await processQueue();
}

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  validateTargetConfig();
  start().catch(e => console.error('Worker error:', e));
}
