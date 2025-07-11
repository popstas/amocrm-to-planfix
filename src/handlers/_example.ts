import { createPlanfixTask } from '../target.js';
import { getWebhookConfig } from '../config.js';
import { appendDefaults } from './utils.js';
import type { ProcessWebhookResult } from './types.js';
import type { WebhookItem } from '../config.js';

export const webhookName = '_example';

export interface ExampleConfig extends WebhookItem {
  exampleField?: string;
}

const webhookConf = getWebhookConfig(webhookName) as ExampleConfig;

export async function processWebhook({ headers, body }: { headers: any; body: any }): Promise<ProcessWebhookResult> {
  const taskParams = { example: webhookConf?.exampleField, headers, body };
  appendDefaults(taskParams, webhookConf);
  const task = await createPlanfixTask(taskParams);
  return { body, lead: {}, taskParams, task };
}

export default { processWebhook };
