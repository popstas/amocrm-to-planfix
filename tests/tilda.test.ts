import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/target.ts', () => ({
  sendToTargets: vi.fn(async () => ({ url: 'ok' }))
}));

import { processWebhook, extractTaskParams } from '../src/handlers/tilda.ts';

const headers = {
  referer: 'https://example.com/form-page-01',
};

const body = {
  name: 'John Doe Joe',
  email: 'john.doe.joe@example.com',
  phone: '+7 (555) 555-55-55',
  refLinkId: '81682',
  userId: '1751020344324579',
  tranid: '7807982:7606836802',
  formid: 'form1069343426',
  formname: 'Запись эфира'
};

const expected = {
  leadSource: 'Tilda',
  name: 'John Doe Joe',
  email: 'john.doe.joe@example.com',
  phone: '+7 (555) 555-55-55',
  description: 'Поля:\nreferer: https://example.com/form-page-01\nformname: Запись эфира',
  fields: {
    referer: 'https://example.com/form-page-01',
    formname: 'Запись эфира',
  }
};

const expectedWithDefaults = {
  ...expected,
  tags: ['landing'],
  pipeline: 'Web',
  project: 'Website'
};

describe('tilda handler', () => {
  it('extracts task params', () => {
    const params = extractTaskParams(body, headers);
    expect(params).toEqual(expected);
  });

  it('processWebhook returns expected structure', async () => {
    const res = await processWebhook({ headers, body });
    expect(res.taskParams).toEqual(expectedWithDefaults);
    expect(res.lead).toEqual(body);
    expect(res.body).toEqual(body);
    expect(res.task).toEqual({ url: 'ok' });
  });

  it('handles capitalized field names and telegram field', () => {
    const capBody = {
      Name: 'Jane Doe',
      Email: 'jane.doe@example.com',
      Phone: '+7 (999) 111-11-11',
      'Ваш_ник_в_Telegram': 'janedoe',
      formname: 'Cart',
    };
    const params = extractTaskParams(capBody, headers);
    expect(params).toEqual({
      leadSource: 'Tilda',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+7 (999) 111-11-11',
      telegram: 'janedoe',
      description: 'Поля:\nreferer: https://example.com/form-page-01\nformname: Cart',
      fields: {
        referer: 'https://example.com/form-page-01',
        formname: 'Cart',
      },
    });
  });

  it('uses default name when not provided', () => {
    const noNameBody = { email: 'a@b.com', phone: '123', formname: 'Form' };
    const params = extractTaskParams(noNameBody, headers);
    expect(params.name).toBe('Unknown name');
  });

  it('handle test webhook', async () => {
    const res = await processWebhook({ headers, body: { test: 'test' } });
    expect(res.taskParams).toEqual({});
    expect(res.lead).toEqual({});
    expect(res.body).toEqual({ test: 'test' });
    expect(res.task).toEqual({});
  });
});
