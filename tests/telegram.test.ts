import { describe, it, expect, vi } from 'vitest';

vi.mock('node-fetch', () => ({
  default: vi.fn(async () => ({ ok: true, json: async () => ({}) }))
}));

import fetch from 'node-fetch';
import { sendTelegramMessage } from '../src/target.ts';

describe('sendTelegramMessage', () => {
  it('adds error tag and text when no task', async () => {
    const params: any = { description: 'Hello', tags: ['foo'] };
    await sendTelegramMessage(params);
    expect(params.tags).toContain('error');
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.text).toBe('Hello\n\nTest error\n\n#foo #error');
  });
});
