import './logger.js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function main() {
  const webhookName = process.argv[2] || 'amocrm';
  const argPath = process.argv[3];
  const bodyPath = argPath ? path.resolve(argPath) : path.join(process.cwd(), 'data', 'body-test.json');
  if (!fs.existsSync(bodyPath)) {
    console.error(`File not found: ${bodyPath}`);
    process.exitCode = 1;
    return;
  }
  const bodyData = fs.readFileSync(bodyPath, 'utf8');
  const body = JSON.parse(bodyData);
  try {
    const mod = await import(`./handlers/${webhookName}.js`);
    const result = await mod.processWebhook({ body });
    console.log('Webhook processed successfully:', JSON.stringify(result));
  } catch (err) {
    console.error('Error processing webhook:', err);
    process.exitCode = 1;
  }
}

main();
