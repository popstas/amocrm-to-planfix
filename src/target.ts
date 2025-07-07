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

export default { createPlanfixTask };
