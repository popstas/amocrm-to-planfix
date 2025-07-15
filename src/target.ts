import fetch from 'node-fetch';
import { config } from './config.js';

export async function createPlanfixTask(taskParams: any) {
  const agentToken = config.target?.token || process.env.AGENT_TOKEN;
  const url = config.target?.url || process.env.CREATE_TASK_URL;
  if (!agentToken) {
    throw new Error('AGENT_TOKEN is required');
  }
  if (!url) {
    throw new Error('CREATE_TASK_URL is required');
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify(taskParams),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `planfix_create_task request failed: ${res.status} ${text}`
    );
  }
  return res.json();
}

export async function sendTelegramMessage(taskParams: any) {
  const botToken = config.telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  const botName = config.telegram?.bot_name || process.env.TELEGRAM_BOT_NAME;
  if (!botToken || !botName) return null;

  let text = taskParams.description || '';
  if (!text) {
    text = JSON.stringify(taskParams);
  }

  if (Array.isArray(taskParams.tags) && taskParams.tags.length) {
    const tags = taskParams.tags.map((t: string) => `#${t}`).join(' ');
    text += (text ? '\n\n' : '') + tags;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: botName, text }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`telegram_send failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function sendToTargets(taskParams: any) {
  const task = await createPlanfixTask(taskParams);
  try {
    await sendTelegramMessage(taskParams);
  } catch (e: any) {
    console.error('Failed to send telegram message:', e.message);
  }
  return task;
}

export default { createPlanfixTask, sendTelegramMessage, sendToTargets };
