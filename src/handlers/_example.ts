import { sendToTargets } from '../target.js';
import { getWebhookConfig } from '../config.js';
import { appendDefaults } from '../utils.js';
import type { ProcessWebhookResult } from '../types/handlers.js';
import type { WebhookItem } from '../config.js';

export const webhookName = '_example';

export interface ExampleConfig extends WebhookItem {
  exampleField?: string;
}

const webhookConf = getWebhookConfig(webhookName) as ExampleConfig;

export async function processWebhook({ headers, body }: { headers: any; body: any }): Promise<ProcessWebhookResult> {
  const taskParams = { example: webhookConf?.exampleField, headers, body };
  appendDefaults(taskParams, webhookConf);
  const task = await sendToTargets(taskParams, webhookName);
  return { body, lead: {}, taskParams, task };
}

export default { processWebhook };
