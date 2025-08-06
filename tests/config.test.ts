import { describe, it, expect, vi } from 'vitest';
import path from 'path';
vi.resetModules();
import { config } from '../src/config.ts';

describe('config loader', () => {
  it('loads config with webhook name', () => {
    expect(config.webhooks[0].name).toBe('amocrm');
  });

  it('loads telegram config', () => {
    expect(config.telegram.bot_name).toBe('example_bot');
    expect(config.telegram.chat_id).toBe('example_chat');
    expect(config.telegram.error_text).toBe('Test error');
  });

  it('loads planfix agent config', () => {
    expect(config.planfix_agent?.url).toBe('http://example.com');
  });

  it('loads projectByTag config', () => {
    const amo = config.webhooks[0] as any;
    expect(amo.projectByTag.tagX).toBe('Project X');
  });

  it('loads projectByPipeline config', () => {
    const amo = config.webhooks[0] as any;
    expect(amo.projectByPipeline.Sales).toBe('SalesProj');
  });

  it('loads projectByTitle config', () => {
    const amo = config.webhooks[0] as any;
    expect(amo.projectByTitle.Lead).toBe('TitleProj');
  });

  it('loads projectByUtmMedium config', () => {
    const amo = config.webhooks[0] as any;
    const tilda = config.webhooks.find(w => w.name === 'tilda') as any;
    expect(amo.projectByUtmMedium.med).toBe('MedProj');
    expect(tilda.projectByUtmMedium.med).toBe('MedProj');
  });

  it('loads projectByUtmCampaign config', () => {
    const amo = config.webhooks[0] as any;
    const tilda = config.webhooks.find(w => w.name === 'tilda') as any;
    expect(amo.projectByUtmCampaign.camp).toBe('CampProj');
    expect(tilda.projectByUtmCampaign.camp).toBe('CampProj');
  });

  it('loads projectByUtmSource config', () => {
    const tilda = config.webhooks.find(w => w.name === 'tilda') as any;
    expect(tilda.projectByUtmSource.src).toBe('SrcProj');
    expect(tilda.tagByUtmSource.src).toBe('SrcTag');
    expect(tilda.tagByTitle['Прямой эфир']).toBe('Рег');
    expect(tilda.projectByTitle['Запись']).toBe('FormProj');
  });

  it('loads ignoreFields defaults', () => {
    const amo = config.webhooks[0] as any;
    const tilda = config.webhooks.find(w => w.name === 'tilda') as any;
    expect(amo.ignoreFields).toEqual([
      'TRANID',
      '_ym_uid',
      'FORMID',
      'COOKIES',
    ]);
    expect(tilda.ignoreFields).toEqual([
      'TRANID',
      '_ym_uid',
      'FORMID',
      'COOKIES',
    ]);
  });
});
