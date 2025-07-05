import { describe, it, expect, vi } from 'vitest';
import path from 'path';
vi.resetModules();
import { config } from '../src/config.ts';

describe('config loader', () => {
  it('loads config with webhook name', () => {
    expect(config.webhooks[0].name).toBe('amocrm');
  });
});
