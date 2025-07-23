// @ts-nocheck
import fetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';
import fs from 'fs';
import path from 'path';
import { config, getWebhookConfig } from '../config.js';
import { sendToTargets } from '../target.js';
import { appendDefaults, matchByConfig, normalizeKey, includesByConfig } from './utils.js';
import type { WebhookItem } from '../config.js';
import type { ProcessWebhookResult } from './types.js';
import { fileURLToPath } from 'url';

export const webhookName = 'amocrm';

export interface AmocrmConfig extends WebhookItem {
  token?: string;
  projectByTag?: Record<string, string>;
  projectByPipeline?: Record<string, string>;
  projectByUtmMedium?: Record<string, string>;
  projectByUtmCampaign?: Record<string, string>;
}

const webhookConf = getWebhookConfig(webhookName) as AmocrmConfig;

async function amoGet(baseUrl, path, token) {
  console.log(`amoCRM request: ${baseUrl}${path}`);
  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  const proxy = config.proxy_url;
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
  const fields: Record<string, string> = {};
  const utm: Record<string, string> = {};
  for (const f of customFields) {
    const name = f.field_name || f.name || f.field_code;
    if (!name) continue;
    const values = Array.isArray(f.values)
      ? f.values.map((v) => v.value).filter(Boolean)
      : [];
    if (values.length) {
      fields[name] = values.join(", ");
      customLines.push(`${name}: ${values.join(", ")}`);
      const norm = normalizeKey(name).replace(/[\s-]+/g, "_");
      if (norm === "utm_source") utm.utm_source = values.join(", ");
      if (norm === "utm_medium") utm.utm_medium = values.join(", ");
      if (norm === "utm_campaign") utm.utm_campaign = values.join(", ");
    }
  }
  Object.assign(fields, utm);
  Object.assign(params, utm);
  params.fields = fields;
  if (params.utm_source) {
    params.leadSource = params.utm_source;
  } else if (params.fields['Источник']) {
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


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function applyProjectByTag(taskParams, projectByTag) {
  if (!projectByTag || !Array.isArray(taskParams.tags)) return taskParams;
  for (const tag of taskParams.tags) {
    const mapped = matchByConfig(projectByTag, tag);
    if (mapped) {
      taskParams.project = mapped;
      break;
    }
  }
  return taskParams;
}

export function applyProjectByPipeline(taskParams, projectByPipeline) {
  if (!projectByPipeline || !taskParams.pipeline) return taskParams;
  const mapped = matchByConfig(projectByPipeline, taskParams.pipeline);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

export function applyProjectByUtmMedium(taskParams, projectByUtmMedium) {
  const medium = taskParams.fields?.utm_medium;
  if (!projectByUtmMedium || !medium) return taskParams;
  const mapped = matchByConfig(projectByUtmMedium, medium);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

export function applyProjectByUtmCampaign(taskParams, projectByUtmCampaign) {
  const campaign = taskParams.fields?.utm_campaign;
  if (!projectByUtmCampaign || !campaign) return taskParams;
  const mapped = includesByConfig(projectByUtmCampaign, campaign);
  if (mapped) taskParams.project = mapped;
  return taskParams;
}

async function processWebhook({ headers, body }, queueRow): Promise<ProcessWebhookResult> {
  const token = webhookConf?.token;
  const webhookDelay = (config.queue?.start_delay ?? 5) * 1000;

  if (!token) throw new Error("AMOCRM access token is required");

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

  appendDefaults(taskParams, webhookConf);
  applyProjectByTag(taskParams, webhookConf?.projectByTag);
  applyProjectByPipeline(taskParams, webhookConf?.projectByPipeline);
  applyProjectByUtmMedium(taskParams, webhookConf?.projectByUtmMedium);
  applyProjectByUtmCampaign(taskParams, webhookConf?.projectByUtmCampaign);

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


  // Create task in Planfix
  const task = await sendToTargets(taskParams, webhookName);
  if (contacts.length === 0) {
    throw new Error(`Lead ${leadId} has no contacts`);
  }

  return { body, lead, taskParams, task };
}

export { processWebhook };
export default { processWebhook };
