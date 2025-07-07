// @ts-nocheck
import fetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { fileURLToPath } from 'url';

const webhookConf = config.webhooks.find((w) => w.name === "amocrm");

async function amoGet(baseUrl, path, token) {
  console.log(`amoCRM request: ${baseUrl}${path}`);
  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  const proxy = process.env.PROXY_URL || config.proxy_url;
  if (proxy) {
    options.agent = new ProxyAgent(proxy);
  }
  const res = await fetch(`${baseUrl}${path}`, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`amoCRM request failed: ${res.status} ${text}`);
  }
  console.log(`status:`, res.status);
  if (res.status === 204) {
    return { status: 204 }; // No content to parse for 204 responses
  }
  return res.json();
}

async function getResponsibleEmail(userId, baseUrl, token) {
  if (!userId) return undefined;
  try {
    const user = await amoGet(baseUrl, `/api/v4/users/${userId}`, token);
    if (user.status === 204) return undefined;
    return user.email || user.login;
  } catch (e) {
    console.error(`Failed to fetch user ${userId}:`, e.message.replace(/[\n|\r]+/g, " "));
    return undefined;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIPELINES_CACHE = path.join(__dirname, "..", "..", "data", "pipelines.json");
const PIPELINES_TTL = 24 * 60 * 60 * 1000; // one day

function loadPipelinesFromCache() {
  try {
    const raw = fs.readFileSync(PIPELINES_CACHE, "utf8");
    const data = JSON.parse(raw);
    if (Date.now() - data.updated < PIPELINES_TTL && data.pipelines) {
      return data.pipelines;
    }
  } catch (e) {
    // ignore cache read errors
  }
  return null;
}

async function fetchPipelines(baseUrl, token) {
  try {
    const data = await amoGet(baseUrl, "/api/v4/leads/pipelines", token);
    const list = data._embedded?.pipelines || [];
    const map = {};
    for (const p of list) {
      if (p.id && p.name) {
        map[p.id] = p.name;
      }
    }
    fs.mkdirSync(path.dirname(PIPELINES_CACHE), { recursive: true });
    fs.writeFileSync(
      PIPELINES_CACHE,
      JSON.stringify({ updated: Date.now(), pipelines: map }, null, 2)
    );
    return map;
  } catch (e) {
    console.error("Failed to fetch pipelines:", e.message.replace(/[\n|\r]+/g, " "));
    return {};
  }
}

async function getPipelineName(pipelineId, baseUrl, token) {
  if (!pipelineId) return undefined;
  let map = loadPipelinesFromCache();
  if (!map || !map[pipelineId]) {
    map = await fetchPipelines(baseUrl, token);
  }
  return map[pipelineId];
}

async function extractLeadDetails(leadOrig, baseUrl, token) {
  try {
    const lead = await amoGet(
      baseUrl,
      `/api/v4/leads/${leadOrig.id}?with=contacts`,
      token
    );
    const deleted = lead.status === 204;
    if (deleted) {
      return { lead: leadOrig, contacts: [], detailedContacts: [], deleted };
    }
    const detailedContacts = [];
    const contacts =
      lead._embedded && Array.isArray(lead._embedded.contacts)
        ? lead._embedded.contacts
        : [];
  
    // Fetch detailed contact information
    for (const c of contacts) {
      const full = await amoGet(baseUrl, `/api/v4/contacts/${c.id}`, token);
      detailedContacts.push(full);
    }
  
    return { lead, contacts, detailedContacts, deleted };
  }
  catch(e) {
    return {
      lead: leadOrig,
      contacts: [],
      detailedContacts: [],
      deleted: false,
    };
  }
}

function extractTaskParams(lead, contacts, detailedContacts, baseUrl, managerEmail) {
  const leadId = lead.id;
  const leadName = lead.name || `Lead ${lead.id}`;
  const title =
    leadName === lead.name || !lead.name
      ? leadName
      : `${leadName} (${lead.name})`;
  const params = { leadId };

  const mainContactId = contacts.find((c) => c.is_main)?.id;
  const mainContact =
    detailedContacts.find((c) => c.id === mainContactId) || detailedContacts[0];

  if (mainContact) {
    if (mainContact.name) {
      params.name = mainContact.name;
    }

    const fields = Array.isArray(mainContact.custom_fields_values)
      ? mainContact.custom_fields_values
      : [];

    for (const f of fields) {
      if (f.field_code === "PHONE" && Array.isArray(f.values) && f.values[0]) {
        params.phone = f.values[0].value;
      }
      if (f.field_code === "EMAIL" && Array.isArray(f.values) && f.values[0]) {
        params.email = f.values[0].value;
      }
      if (f.field_name === "TelegramUsername_WZ" && Array.isArray(f.values) && f.values[0]) {
        params.telegram = f.values[0].value;
      }
      if (f.field_code === "IM" && Array.isArray(f.values)) {
        const tg = f.values.find((v) => v.enum_code === "TELEGRAM");
        if (tg) params.telegram = tg.value;
      }
    }
  }

  const tags = lead._embedded?.tags || lead.tags || [];
  const tagNames = Array.isArray(tags)
    ? tags.map((t) => t.name).filter(Boolean)
    : [];

  const customFields = lead.custom_fields_values || lead.custom_fields || [];
  const customLines = [];
  const fields = {};
  for (const f of customFields) {
    const name = f.field_name || f.name || f.field_code;
    if (!name) continue;
    const values = Array.isArray(f.values)
      ? f.values.map((v) => v.value).filter(Boolean)
      : [];
    if (values.length) {
      fields[name] = values.join(", ");
      customLines.push(`${name}: ${values.join(", ")}`);
    }
  }
  params.fields = fields;
  if (params.fields['utm_source']) {
    params.leadSource = params.fields['utm_source'];
  }
  else if (params.fields['Источник']) {
    params.leadSource = params.fields['Источник'];
  }

  const descriptionParts = [];

  if (tagNames.length) {
    params.tags = tagNames;
    descriptionParts.push("", "Теги:", tagNames.join(", "));
  }
  
  if (customLines.length) {
    descriptionParts.push("", "Поля:", ...customLines);
  }

  descriptionParts.push("", `Название: ${title}`);
  if (managerEmail) {
    descriptionParts.push(`Менеджер: ${managerEmail}`);
  }
  descriptionParts.push(`URL: ${baseUrl}/leads/detail/${leadId}`);

  params.description = descriptionParts.join("\n");
  return params;
}

async function createPlanfixTask(taskParams, agentToken, createTaskUrl) {
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processWebhook({ body }, queueRow) {
  const token = webhookConf?.token || process.env.AMOCRM_TOKEN;
  const agentToken = config.target?.token || process.env.AGENT_TOKEN;
  const createTaskUrl = config.target?.url || process.env.CREATE_TASK_URL;
  const webhookDelay = (config.queue?.start_delay ?? parseInt(process.env.WEBHOOK_DELAY || '5', 10)) * 1000;

  if (!token) throw new Error("AMOCRM access token is required");
  if (!agentToken) throw new Error("AGENT_TOKEN is required");

  console.log(`processWebhook: leadId: ${body.leads?.add?.[0]?.id}, body: ${JSON.stringify(body)}`);
  // Access the nested properties directly from the object structure
  const baseUrl = (body.account?._links?.self || '').replace(/\/$/, '');
  const leadShort = body.leads?.add?.[0];
  const leadId = leadShort?.id;

  if (!baseUrl || !leadId) {
    throw new Error("Invalid webhook body: missing baseUrl or leadId");
  }

  // Add delay before processing
  if (process.env.NODE_ENV === "production") {
    console.log(`Waiting ${webhookDelay/1000} seconds before processing lead...`);
    await delay(webhookDelay);
  }
  
  // Extract lead and contact details
  const { lead, contacts, detailedContacts, deleted } = await extractLeadDetails(
    leadShort,
    baseUrl,
    token
  );

  const managerEmail = await getResponsibleEmail(
    lead.responsible_user_id || leadShort.responsible_user_id,
    baseUrl,
    token
  );

  const pipelineName = await getPipelineName(
    lead.pipeline_id || leadShort.pipeline_id,
    baseUrl,
    token
  );

  // Prepare task parameters
  const taskParams = extractTaskParams(
    lead,
    contacts,
    detailedContacts,
    baseUrl,
    managerEmail
  );
  if (pipelineName) {
    taskParams.pipeline = pipelineName;
  }

  if (deleted) {
    console.error(`Lead ${leadId} deleted`);
    return { body, lead, taskParams, task: null };
  }

  if (contacts.length === 0) {
    console.error(`Failed to retrieve lead details for lead ID: ${leadId}`);
    // create task first, then waiting for contacts appears 
    if (queueRow.attempts > 0) {
      throw new Error(`Failed to retrieve lead details for lead ID: ${leadId}`);
    }
  }

  if (process.env.MANAGER_EMAIL) {
    taskParams.managerEmail = process.env.MANAGER_EMAIL;
  }

  // Create task in Planfix
  if (createTaskUrl) {
    const task = await createPlanfixTask(taskParams, agentToken, createTaskUrl);
    if (contacts.length === 0) {
      throw new Error(`Lead ${leadId} has no contacts`);
    }
    if (task?.url) {
      console.log('result:', task.url);
    } else {
      console.error('Error: failed to create task');
      if (task.error) {
        console.error('Error:', task.error);
      }
    }
    return { body, lead, taskParams, task };
  }

  return { body, lead, taskParams };
}

export { processWebhook };
export default { processWebhook };
