import { sendToTargets } from '../target.js';
import { getWebhookConfig } from '../config.js';
import { appendDefaults, matchByConfig, includesByConfig } from './utils.js';
import type { ProcessWebhookResult } from './types.js';
import type { WebhookItem } from '../config.js';

export const webhookName = 'tilda';

export interface TildaConfig extends WebhookItem {
  leadSource?: string;
  tagByTitle?: Record<string, string>;
  tagByUtmSource?: Record<string, string>;
  projectByTitle?: Record<string, string>;
  projectByUtmSource?: Record<string, string>;
  projectByUtmMedium?: Record<string, string>;
  projectByUtmCampaign?: Record<string, string>;
  ignoreFields?: string[];
}

function webhookConf(): TildaConfig | undefined {
  return getWebhookConfig(webhookName) as TildaConfig;
}

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
  const params: any = { leadSource: webhookConf()?.leadSource || 'Tilda' };

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

  const utmSourceField = findField(body, [/^utm[ _-]?source$/i]);
  if (utmSourceField.key) {
    fields.utm_source = utmSourceField.value;
    params.utm_source = utmSourceField.value;
    recognized.add(utmSourceField.key.toLowerCase());
  }

  const utmMediumField = findField(body, [/^utm[ _-]?medium$/i]);
  if (utmMediumField.key) {
    fields.utm_medium = utmMediumField.value;
    params.utm_medium = utmMediumField.value;
    recognized.add(utmMediumField.key.toLowerCase());
  }

  const utmCampaignField = findField(body, [/^utm[ _-]?campaign$/i]);
  if (utmCampaignField.key) {
    fields.utm_campaign = utmCampaignField.value;
    params.utm_campaign = utmCampaignField.value;
    recognized.add(utmCampaignField.key.toLowerCase());
  }

  if (headers?.referer) {
    try {
      const url = new URL(headers.referer);
      const searchParams = url.searchParams;
      const utmSource = searchParams.get('utm_source');
      const utmMedium = searchParams.get('utm_medium');
      const utmCampaign = searchParams.get('utm_campaign');
      if (utmSource) {
        fields.utm_source = utmSource;
        params.utm_source ||= utmSource;
      }
      if (utmMedium) {
        fields.utm_medium = utmMedium;
        params.utm_medium ||= utmMedium;
      }
      if (utmCampaign) {
        fields.utm_campaign = utmCampaign;
        params.utm_campaign ||= utmCampaign;
      }
      searchParams.delete('mcp_token');
      const search = searchParams.toString();
      url.search = search ? `?${search}` : '';
      fields.referer = url.toString();
    } catch {
      fields.referer = headers.referer;
    }
    lines.push(`referer: ${fields.referer}`);
  }

  const ignored = new Set([
    'name',
    'email',
    'phone',
    'telegram',
    'reflinkid',
    'userid',
    ...(
      webhookConf()?.ignoreFields ?? ['TRANID', '_ym_uid', 'FORMID', 'COOKIES']
    ).map((v) => v.toLowerCase()),
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

function appendTagsByTitle(taskParams: any, formTitle: string | undefined, conf = webhookConf()): any {
  if (!formTitle || !conf?.tagByTitle) return taskParams;
  const tags = new Set<string>(taskParams.tags || []);
  for (const [title, tag] of Object.entries(conf.tagByTitle)) {
    if (formTitle.toLowerCase().includes(title.toLowerCase())) {
      tags.add(tag);
    }
  }
  if (tags.size) {
    taskParams.tags = Array.from(tags);
  }
  return taskParams;
}

function applyProjectByTitle(taskParams: any, formTitle: string | undefined, conf = webhookConf()): any {
  if (!formTitle || !conf?.projectByTitle) return taskParams;
  for (const [title, project] of Object.entries(conf.projectByTitle)) {
    if (formTitle.toLowerCase().includes(title.toLowerCase())) {
      taskParams.project = project;
      break;
    }
  }
  return taskParams;
}

function applyProjectByUtmSource(taskParams: any, conf = webhookConf()): any {
  const utm = taskParams.fields?.utm_source;
  if (!utm || !conf?.projectByUtmSource) return taskParams;
  const mapped = matchByConfig(conf.projectByUtmSource, utm);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

function applyProjectByUtmMedium(taskParams: any, conf = webhookConf()): any {
  const medium = taskParams.fields?.utm_medium;
  if (!medium || !conf?.projectByUtmMedium) return taskParams;
  const mapped = matchByConfig(conf.projectByUtmMedium, medium);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

function applyProjectByUtmCampaign(taskParams: any, conf = webhookConf()): any {
  const campaign = taskParams.fields?.utm_campaign;
  if (!campaign || !conf?.projectByUtmCampaign) return taskParams;
  const mapped = includesByConfig(conf.projectByUtmCampaign, campaign);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

function appendTagByUtmSource(taskParams: any, conf = webhookConf()): any {
  const utm = taskParams.fields?.utm_source;
  if (!utm || !conf?.tagByUtmSource) return taskParams;
  const mapped = matchByConfig(conf.tagByUtmSource, utm);
  if (mapped) {
    const tags = new Set<string>(taskParams.tags || []);
    tags.add(mapped);
    taskParams.tags = Array.from(tags);
  }
  return taskParams;
}

export async function processWebhook({ headers = {}, body }: { headers: any; body: any }): Promise<ProcessWebhookResult> {
  if (isTestWebhook(body)) {
    return { body, lead: {}, taskParams: {}, task: {} };
  }
  const taskParams = extractTaskParams(body, headers);
  appendDefaults(taskParams, webhookConf());
  const formTitle: string | undefined = body.formname || body.FORMNAME;
  appendTagsByTitle(taskParams, formTitle, webhookConf());
  applyProjectByTitle(taskParams, formTitle, webhookConf());
  appendTagByUtmSource(taskParams, webhookConf());
  applyProjectByUtmSource(taskParams, webhookConf());
  applyProjectByUtmMedium(taskParams, webhookConf());
  applyProjectByUtmCampaign(taskParams, webhookConf());
  const task = await sendToTargets(taskParams, webhookName);
  return { body, lead: body, taskParams, task };
}

export default { processWebhook };
