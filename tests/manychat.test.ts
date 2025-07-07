import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/target.ts', () => ({
  createPlanfixTask: vi.fn(async () => ({ url: 'ok' }))
}));

import { processWebhook, extractTaskParams } from '../src/handlers/manychat.ts';

const body = {
  contact: {
    id: '134',
    first_name: 'John',
    last_name: 'Doe Joe',
    name: 'John Doe Joe',
    phone: '1234567890',
    email: 'john.doe.joe@example.com',
    last_input_text: 'Hii 🥺',
    ig_username: 'john_doe',
    ig_id: 181,
    whatsapp_phone: '5555555555',
    timezone: 'UTC±00',
    live_chat_url: 'https://app.manychat.com/fb299/chat/134'
  }
};

const expected = {
  leadSource: 'ManyChat',
  name: 'John Doe Joe',
  email: 'john.doe.joe@example.com',
  phone: '1234567890',
  desctiprion: 'Hii 🥺',
  ig_username: 'john_doe',
  fields: {
    timezone: 'UTC±00',
    live_chat_url: 'https://app.manychat.com/fb299/chat/134'
  }
};

describe('manychat handler', () => {
  it('extracts task params', () => {
    const params = extractTaskParams(body.contact);
    expect(params).toEqual(expected);
  });

  it('processWebhook returns expected structure', async () => {
    const res = await processWebhook({ body });
    expect(res.taskParams).toEqual(expected);
    expect(res.lead).toEqual(body.contact);
    expect(res.body).toEqual(body);
    expect(res.task).toEqual({ url: 'ok' });
  });
});
