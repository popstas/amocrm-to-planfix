import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface WebhookItem {
  name: string;
  token?: string;
  webhook_path: string;
  tags?: string[];
  pipeline?: string;
  project?: string;
  leadSource?: string;
  ignoreFields?: string[];
}
export interface QueueConfig { max_attempts?: number; start_delay?: number; }
export interface PlanfixAgentConfig { token?: string; url?: string; }
export interface TelegramConfig {
  bot_name: string;
  bot_token: string;
  chat_id: string;
  error_text?: string;
}

export interface Config {
  webhooks: WebhookItem[];
  queue?: QueueConfig;
  planfix_agent?: PlanfixAgentConfig;
  telegram?: TelegramConfig;
  proxy_url?: string;
}

const defaultPath = path.join(process.cwd(), 'data', 'config.yml');
export const configPath = process.env.CONFIG || defaultPath;

export let config: Config;

export function loadConfig(): Config {
  config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Config;
  return config;
}

loadConfig();

const DEFAULT_IGNORE_FIELDS = ['TRANID', '_ym_uid', 'FORMID', 'COOKIES'];
for (const wh of config.webhooks) {
  if ((wh.name === 'amocrm' || wh.name === 'tilda') && !wh.ignoreFields) {
    wh.ignoreFields = DEFAULT_IGNORE_FIELDS;
  }
}

export function getWebhookConfig(name: string): WebhookItem | undefined {
  return config.webhooks.find(w => w.name === name);
}
