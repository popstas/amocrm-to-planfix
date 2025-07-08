import { createPlanfixTask } from '../target.js';
import { getWebhookConfig } from '../config.js';
import type { ProcessWebhookResult } from './types.js';
import type { WebhookItem } from '../config.js';

export const webhookName = 'tilda';

export interface TildaConfig extends WebhookItem {
  leadSource?: string;
}

const webhookConf = getWebhookConfig(webhookName) as TildaConfig;

export function extractTaskParams(body: any, headers: any): any {
  const params: any = { leadSource: webhookConf?.leadSource || 'Tilda' };

  params.name = body.name || 'Unknown name';
  if (body.email) params.email = body.email;
  if (body.phone) params.phone = body.phone;

  const fields: any = {};
  const lines: string[] = [];

  if (headers?.referer) {
    fields.referer = headers.referer;
    lines.push(`referer: ${headers.referer}`);
  }

  const ignored = ['name', 'email', 'phone', 'refLinkId', 'userId', 'tranid', 'formid'];
  for (const [key, value] of Object.entries(body)) {
    if (ignored.includes(key) || value === undefined || value === null || value === '') {
      continue;
    }
    fields[key] = value;
    lines.push(`${key}: ${value}`);
  }

  if (Object.keys(fields).length) params.fields = fields;
  if (lines.length) {
    params.description = ['Поля:', ...lines].join('\n');
  }

  return params;
}

export async function processWebhook({ headers = {}, body }: { headers: any; body: any }): Promise<ProcessWebhookResult> {
  const taskParams = extractTaskParams(body, headers);
  const task = await createPlanfixTask(taskParams);
  return { body, lead: body, taskParams, task };
}

export default { processWebhook };
