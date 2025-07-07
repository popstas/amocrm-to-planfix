import fetch from 'node-fetch';

export async function createPlanfixTask(taskParams: any, agentToken: string, createTaskUrl: string) {
  const url = createTaskUrl || "";
  if (!url) {
    throw new Error("CREATE_TASK_URL is required");
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
