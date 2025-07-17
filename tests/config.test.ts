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
  });

  it('loads planfix agent config', () => {
    expect(config.planfix_agent?.url).toBe('http://example.com');
  });

  it('loads projectByTags config', () => {
    const amo = config.webhooks[0] as any;
    expect(amo.projectByTags.tagX).toBe('Project X');
  });

  it('loads projectByPipelines config', () => {
    const amo = config.webhooks[0] as any;
    expect(amo.projectByPipelines.Sales).toBe('SalesProj');
  });

  it('loads projectByUtmSource config', () => {
    const tilda = config.webhooks.find(w => w.name === 'tilda') as any;
    expect(tilda.projectByUtmSource.src).toBe('SrcProj');
  });
});
