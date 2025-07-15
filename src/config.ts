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
}
export interface QueueConfig { max_attempts?: number; start_delay?: number; }
export interface PlanfixAgentConfig { token?: string; url?: string; }
export interface TelegramConfig {
  bot_name?: string;
  bot_token?: string;
  chat_id?: string;
}

export interface Config {
  webhooks: WebhookItem[];
  queue?: QueueConfig;
  planfix_agent?: PlanfixAgentConfig;
  telegram?: TelegramConfig;
  proxy_url?: string;
}

const defaultPath = path.join(process.cwd(), 'data', 'config.yml');
const configPath = process.env.CONFIG || defaultPath;

export const config: Config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Config;

export function getWebhookConfig(name: string): WebhookItem | undefined {
  return config.webhooks.find(w => w.name === name);
}
