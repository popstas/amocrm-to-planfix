import { config, getWebhookConfig } from '../config.js';
import { createPlanfixTask } from '../target.js';
import type { ProcessWebhookResult } from './types.js';

const webhookConf = getWebhookConfig('manychat');

export function extractLeadDetails(body: any): { lead: any } {
  return { lead: body.contact || {} };
}

export function extractTaskParams(lead: any): any {
  const contact = lead || {};
  const params: any = { leadSource: webhookConf?.leadSource || 'ManyChat' };

  const name = contact.name || contact.ig_username || (contact.ig_id ? `Instagram id ${contact.ig_id}` : undefined);
  if (name) params.name = name;
  if (contact.email) params.email = contact.email;
  const phone = contact.phone || contact.whatsapp_phone;
  if (phone) params.phone = phone;
  if (contact.ig_username) params.instagram = contact.ig_username;

  const fields: any = {};
  if (contact.ig_username) fields.ig_username = contact.ig_username;
  if (contact.timezone) fields.timezone = contact.timezone;
  if (contact.live_chat_url) fields.live_chat_url = contact.live_chat_url;
  if (Object.keys(fields).length) params.fields = fields;

  const descriptionParts = [];
  if (contact.last_input_text) descriptionParts.push(contact.last_input_text);

  const customLines = [];
  for (const fName in fields) {
    customLines.push(`${fName}: ${fields[fName]}`);
  }
  if (customLines.length) {
    descriptionParts.push("", "Поля:", ...customLines);
  }

  params.description = descriptionParts.join("\n");

  return params;
}

export async function processWebhook({ body }: { body: any }): Promise<ProcessWebhookResult> {
  const agentToken = config.target?.token || process.env.AGENT_TOKEN;
  const createTaskUrl = config.target?.url || process.env.CREATE_TASK_URL;
  if (!agentToken) throw new Error('AGENT_TOKEN is required');

  console.log(`processWebhook manychat: body: ${JSON.stringify(body)}`);

  const { lead } = extractLeadDetails(body);
  const taskParams = extractTaskParams(lead);

  let task;
  if (createTaskUrl) {
    task = await createPlanfixTask(taskParams, agentToken, createTaskUrl);
  }

  return { body, lead, taskParams, task };
}

export default { processWebhook };
