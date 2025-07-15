import { describe, it, expect, vi } from 'vitest';
import path from 'path';
vi.resetModules();
import { config } from '../src/config.ts';

describe('config loader', () => {
  it('loads config with webhook name', () => {
    expect(config.webhooks[0].name).toBe('amocrm');
  });

  it('loads telegram config', () => {
    expect(config.telegram?.bot_name).toBe('example_bot');
  });

  it('loads planfix agent config', () => {
    expect(config.planfix_agent?.url).toBe('http://example.com');
  });
});
