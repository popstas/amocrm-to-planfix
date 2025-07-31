import './logger.js';
import 'dotenv/config';
import { processQueue } from './queue.js';
import fs from 'fs';
import { loadConfig, configPath } from './config.js';
import { fileURLToPath } from 'url';

function validateTargetConfig() {
  const cfg = loadConfig();
  const url = cfg.planfix_agent?.url;
  const token = cfg.planfix_agent?.token;
  if (!url || !token) {
    console.error('Missing planfix_agent.url or planfix_agent.token');
    process.exit(1);
  }
}

export async function start() {
  console.log('Worker started');
  await processQueue();
}

fs.watchFile(configPath, () => {
  console.log('Config file changed, reloading');
  loadConfig();
});

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  validateTargetConfig();
  start().catch(e => console.error('Worker error:', e));
}
