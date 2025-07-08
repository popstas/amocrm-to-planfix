import './logger.js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function main() {
  const webhookName = process.argv[2] || 'amocrm';
  const bodyArg = process.argv[3];
  const headersArg = process.argv[4];
  const bodyPath = bodyArg ? path.resolve(bodyArg) : path.join(process.cwd(), 'data', 'body-test.json');
  const headersPath = headersArg ? path.resolve(headersArg) : path.join(process.cwd(), 'data', 'headers-test.json');
  if (!fs.existsSync(bodyPath)) {
    console.error(`File not found: ${bodyPath}`);
    process.exitCode = 1;
    return;
  }
  const bodyData = fs.readFileSync(bodyPath, 'utf8');
  const body = JSON.parse(bodyData);
  let headers: any = {};
  if (fs.existsSync(headersPath)) {
    headers = JSON.parse(fs.readFileSync(headersPath, 'utf8'));
  } else if (headersArg) {
    console.error(`File not found: ${headersPath}`);
    process.exitCode = 1;
    return;
  } else {
    headers = {};
  }
  try {
    const mod = await import(`./handlers/${webhookName}.js`);
    const result = await mod.processWebhook({ headers, body });
    console.log('Webhook processed successfully:', JSON.stringify(result));
  } catch (err) {
    console.error('Error processing webhook:', err);
    process.exitCode = 1;
  }
}

main();
