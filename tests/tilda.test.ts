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
  formname: 'Базовая форма'
};

const expected = {
  leadSource: 'Tilda',
  name: 'John Doe Joe',
  email: 'john.doe.joe@example.com',
  phone: '+7 (555) 555-55-55',
  description: 'Поля:\nreferer: https://example.com/form-page-01\nformname: Базовая форма',
  fields: {
    referer: 'https://example.com/form-page-01',
    formname: 'Базовая форма',
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

  it('adds tag based on form title', async () => {
    const matchBody = { name: 'Test', FORMNAME: 'Прямой эфир 16.07' } as any;
    const res = await processWebhook({ headers, body: matchBody });
    expect(res.taskParams.tags).toEqual(['landing', 'Рег']);
  });

  it('sets project based on form title', async () => {
    const matchBody = { name: 'Test', formname: 'Запись эфира' } as any;
    const res = await processWebhook({ headers, body: matchBody });
    expect(res.taskParams.project).toBe('FormProj');
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

  it('ignores default extra fields', () => {
    const extraBody = {
      name: 'A',
      TRANID: '1',
      _ym_uid: '2',
      FORMID: '3',
      COOKIES: 'c',
    } as any;
    const params = extractTaskParams(extraBody, headers);
    expect(params.fields).toEqual({ referer: headers.referer });
  });

  it('uses default name when not provided', () => {
    const noNameBody = { email: 'a@b.com', phone: '123', formname: 'Form' };
    const params = extractTaskParams(noNameBody, headers);
    expect(params.name).toBe('Unknown name');
  });

  it('parses utm params and strips mcp_token', () => {
    const hdrs = {
      referer:
        'https://example.com/page?utm_source=src&utm_medium=med&utm_campaign=camp&mcp_token=abc&foo=bar',
    };
    const params = extractTaskParams({}, hdrs);
    expect(params.fields).toEqual({
      referer:
        'https://example.com/page?utm_source=src&utm_medium=med&utm_campaign=camp&foo=bar',
      utm_source: 'src',
      utm_medium: 'med',
      utm_campaign: 'camp',
    });
    expect(params.utm_source).toBe('src');
    expect(params.utm_medium).toBe('med');
    expect(params.utm_campaign).toBe('camp');
  });

  it('extracts utm fields from body', () => {
    const params = extractTaskParams(
      {
        name: 'A',
        Utm_Source: 'src',
        'UTM MEDIUM': 'med',
        'utm-campaign': 'camp',
      } as any,
      {}
    );
    expect(params.fields).toEqual({
      utm_source: 'src',
      utm_medium: 'med',
      utm_campaign: 'camp',
    });
    expect(params.utm_source).toBe('src');
    expect(params.utm_medium).toBe('med');
    expect(params.utm_campaign).toBe('camp');
  });

  it('sets project based on utm_source', async () => {
    const hdrs = {
      referer: 'https://example.com/page?utm_source=SRC',
    };
    const res = await processWebhook({ headers: hdrs, body: { name: 'A' } as any });
    expect(res.taskParams.project).toBe('SrcProj');
  });

  it('sets project based on utm_medium', async () => {
    const hdrs = {
      referer: 'https://example.com/page?utm_medium=MED',
    };
    const res = await processWebhook({ headers: hdrs, body: { name: 'A' } as any });
    expect(res.taskParams.project).toBe('MedProj');
  });

  it('sets project based on utm_campaign substring', async () => {
    const hdrs = {
      referer: 'https://example.com/page?utm_campaign=WinterCamp',
    };
    const res = await processWebhook({ headers: hdrs, body: { name: 'A' } as any });
    expect(res.taskParams.project).toBe('CampProj');
  });

  it('matches campaign names case-insensitively', async () => {
    const hdrs = {
      referer: 'https://example.com/page?utm_campaign=sPRING-cAmp',
    };
    const res = await processWebhook({ headers: hdrs, body: { name: 'A' } as any });
    expect(res.taskParams.project).toBe('CampProj');
  });

  it('adds tag based on utm_source', async () => {
    const hdrs = {
      referer: 'https://example.com/page?utm_source=src',
    };
    const res = await processWebhook({ headers: hdrs, body: { name: 'A' } as any });
    expect(res.taskParams.tags).toContain('SrcTag');
  });

  it('handle test webhook', async () => {
    const res = await processWebhook({ headers, body: { test: 'test' } });
    expect(res.taskParams).toEqual({});
    expect(res.lead).toEqual({});
    expect(res.body).toEqual({ test: 'test' });
    expect(res.task).toEqual({});
  });
});
