require('./logger');
require('dotenv').config();
const { processQueue } = require('./queue');

async function start() {
  console.log('Worker started');
  await processQueue();
}

if (require.main === module) {
  start().catch((e) => console.error('Worker error:', e));
}

module.exports = { start };
