const fetch = require("node-fetch");

async function amoGet(baseUrl, path, token) {
  console.log(`amoCRM request: ${baseUrl}${path}`);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`amoCRM request failed: ${res.status} ${text}`);
  }
  console.log(`status:`, res.status);
  if (res.status === 204) {
    return null; // No content to parse for 204 responses
  }
  return res.json();
}

async function extractLeadDetails(leadId, baseUrl, token) {
  try {
    const lead = await amoGet(
      baseUrl,
      `/api/v4/leads/${leadId}?with=contacts`,
      token
    );
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
  
    return { lead, contacts, detailedContacts };
  }
  catch(e) {
    return {
      lead: { id: leadId },
      contacts: [],
      detailedContacts: [],
    };
  }
}

function extractTaskParams(lead, contacts, detailedContacts, baseUrl) {
  const leadId = lead.id;
  const leadName = lead.name || "New Lead";
  const title =
    leadName === lead.name || !lead.name
      ? leadName
      : `${leadName} (${lead.name})`;
  const params = { title };

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
      if (f.field_code === "IM" && Array.isArray(f.values)) {
        const tg = f.values.find((v) => v.enum_code === "TELEGRAM");
        if (tg) params.telegram = tg.value;
      }
    }
  }

  const tagNames = Array.isArray(lead._embedded?.tags)
    ? lead._embedded.tags.map((t) => t.name).filter(Boolean)
    : [];

  const customFields = Array.isArray(lead.custom_fields_values)
    ? lead.custom_fields_values
    : [];

  const customLines = [];
  for (const f of customFields) {
    const name = f.field_name || f.field_code;
    if (!name) continue;
    const values = Array.isArray(f.values)
      ? f.values.map((v) => v.value).filter(Boolean)
      : [];
    if (values.length) {
      customLines.push(`${name}: ${values.join(", ")}`);
    }
  }

  const descriptionParts = [];
  if (tagNames.length) {
    descriptionParts.push(`Теги: ${tagNames.join(", ")}`);
  }
  if (customLines.length) {
    descriptionParts.push("", "Поля:", ...customLines);
  }
  descriptionParts.push("", `URL: ${baseUrl}/leads/detail/${leadId}`);

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

async function processWebhook(inputData) {
  const body = inputData.body || {};
  const token = inputData.amocrm_token || process.env.AMOCRM_TOKEN;
  const agentToken = inputData.agent_token || process.env.AGENT_TOKEN;
  const createTaskUrl = process.env.CREATE_TASK_URL;
  const webhookDelay = parseInt(process.env.WEBHOOK_DELAY || '5', 10) * 1000; // Convert to milliseconds

  if (!token) throw new Error("AMOCRM access token is required");
  if (!agentToken) throw new Error("AGENT_TOKEN is required");

  console.log('body: ', JSON.stringify(body));
  // Access the nested properties directly from the object structure
  const baseUrl = (body.account?._links?.self || '').replace(/\/$/, '');
  const leadId = body.leads?.add?.[0]?.id;

  if (!baseUrl || !leadId) {
    throw new Error("Invalid webhook body: missing baseUrl or leadId");
  }

  // Add delay before processing
  if (process.env.NODE_ENV === "production") {
    console.log(`Waiting ${webhookDelay/1000} seconds before processing lead...`);
    await delay(webhookDelay);
  }
  
  // Extract lead and contact details
  const { lead, contacts, detailedContacts } = await extractLeadDetails(
    leadId,
    baseUrl,
    token
  );

  if (!lead.name) {
    console.error(`Failed to retrieve lead details for lead ID: ${leadId}`);
    // throw new Error(`Unable to process webhook: Lead ${leadId} not found or inaccessible`);
  }

  // Prepare task parameters
  const taskParams = extractTaskParams(
    lead,
    contacts,
    detailedContacts,
    baseUrl
  );

  // Create task in Planfix
  if (createTaskUrl) {
    const task = await createPlanfixTask(taskParams, agentToken, createTaskUrl);
    return { body, lead, taskParams, task };
  }

  return { body, lead, taskParams };
}

module.exports = { processWebhook };
