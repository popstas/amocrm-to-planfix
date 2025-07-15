import { sendToTargets } from '../target.js';
import { getWebhookConfig } from '../config.js';
import { appendDefaults } from './utils.js';
import type { ProcessWebhookResult } from './types.js';
import type { WebhookItem } from '../config.js';

export const webhookName = 'tilda';

export interface TildaConfig extends WebhookItem {
  leadSource?: string;
}

const webhookConf = getWebhookConfig(webhookName) as TildaConfig;

function findField(
  body: Record<string, any>,
  patterns: RegExp[]
): { key?: string; value?: any } {
  for (const [key, value] of Object.entries(body)) {
    for (const p of patterns) {
      if (p.test(key)) return { key, value };
    }
  }
  return {};
}

export function extractTaskParams(body: any, headers: any): any {
  const params: any = { leadSource: webhookConf?.leadSource || 'Tilda' };

  const recognized = new Set<string>();

  const nameField = findField(body, [/^name$/i, /^имя$/i]);
  params.name = nameField.value || 'Unknown name';
  if (nameField.key) recognized.add(nameField.key.toLowerCase());

  const emailField = findField(body, [/^e-?mail$/i, /^email$/i, /^почта$/i]);
  if (emailField.key) {
    params.email = emailField.value;
    recognized.add(emailField.key.toLowerCase());
  }

  const phoneField = findField(body, [/^phone$/i, /^телефон$/i]);
  if (phoneField.key) {
    params.phone = phoneField.value;
    recognized.add(phoneField.key.toLowerCase());
  }

  const telegramField = findField(body, [/telegram/i, /телеграм/i]);
  if (telegramField.key) {
    params.telegram = telegramField.value;
    recognized.add(telegramField.key.toLowerCase());
  }

  const fields: any = {};
  const lines: string[] = [];

  if (headers?.referer) {
    fields.referer = headers.referer;
    lines.push(`referer: ${headers.referer}`);
  }

  const ignored = new Set([
    'name',
    'email',
    'phone',
    'telegram',
    'reflinkid',
    'userid',
    'tranid',
    'formid',
  ]);
  for (const [key, value] of Object.entries(body)) {
    const keyLower = key.toLowerCase();
    if (
      ignored.has(keyLower) ||
      recognized.has(keyLower) ||
      value === undefined ||
      value === null ||
      value === ''
    ) {
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

function isTestWebhook(body: any): boolean {
  return body.test === 'test';
}

export async function processWebhook({ headers = {}, body }: { headers: any; body: any }): Promise<ProcessWebhookResult> {
  if (isTestWebhook(body)) {
    return { body, lead: {}, taskParams: {}, task: {} };
  }
  const taskParams = extractTaskParams(body, headers);
  appendDefaults(taskParams, webhookConf);
  const task = await sendToTargets(taskParams);
  return { body, lead: body, taskParams, task };
}

export default { processWebhook };
