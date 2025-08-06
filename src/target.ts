import fetch from 'node-fetch';
import { loadConfig } from './config.js';

export async function createPlanfixTask(taskParams: any) {
  const cfg = loadConfig();
  const agentToken = cfg.planfix_agent?.token;
  const url = cfg.planfix_agent?.url;
  if (!agentToken) {
    throw new Error('planfix_agent.token is required');
  }
  if (!url) {
    throw new Error('planfix_agent.url is required');
  }

  if (taskParams.instagram) taskParams.instagram_custom = taskParams.instagram;

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

export async function sendTelegramMessage(
  taskParams: any,
  webhookName = '',
  task: any = null
) {
  const cfg = loadConfig();
  if (!cfg.telegram) return null;
  const { bot_token: botToken, chat_id: chatId, error_text: errorText } = cfg.telegram;
  if (!botToken || !chatId) return null;

  if (!task) {
    if (!Array.isArray(taskParams.tags)) taskParams.tags = [];
    if (!taskParams.tags.includes('error')) taskParams.tags.push('error');
  }

  let text = (taskParams.description || '').trim();
  if (!text) {
    text = JSON.stringify(taskParams);
  }

  const details: string[] = [];
  if (taskParams.name) details.push(`Имя: ${taskParams.name}`);
  if (taskParams.phone) details.push(`Телефон: ${taskParams.phone}`);
  if (taskParams.email) details.push(`Email: ${taskParams.email}`);
  if (taskParams.telegram) details.push(`Telegram: ${taskParams.telegram}`);
  if (taskParams.instagram) details.push(`Instagram: https://instagram.com/${taskParams.instagram}`);
  if (taskParams.pipeline) details.push(`Воронка: ${taskParams.pipeline}`);
  if (taskParams.leadSource)
    details.push(`Источник продажи: ${taskParams.leadSource}`);
  if (details.length) {
    text = `${details.join('\n')}\n\n${text}`;
  }

  if (webhookName) {
    text = `${webhookName}:\n\n${text}`;
  }

  if (task?.url) {
    text = `${text}\n\nПланфикс:\n${task.url}`;
  }
  else {
    if (!taskParams.tags) taskParams.tags = [];
    if (!taskParams.tags.includes('error')) taskParams.tags.push('error');
  }

  if (taskParams.tags.includes('error') && errorText) {
    text = `${text}\n\n${errorText}`;
  }

  if (Array.isArray(taskParams.tags) && taskParams.tags.length) {
    const tags = taskParams.tags.map((t: string) => `#${t}`).join(' ');
    text = `${text}\n\n${tags}`;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`telegram_send failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function sendToTargets(taskParams: any, webhookName = '') {
  const task = await createPlanfixTask(taskParams);
  try {
    await sendTelegramMessage(taskParams, webhookName, task);
  } catch (e: any) {
    console.error('Failed to send telegram message:', e.message);
  }
  return task;
}

export default { createPlanfixTask, sendTelegramMessage, sendToTargets };
