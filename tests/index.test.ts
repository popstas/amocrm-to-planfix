import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
vi.resetModules();
vi.mock('../src/queue.ts', () => ({ addWebhook: vi.fn(async () => true) }));

import app from '../src/index.ts';
import { addWebhook } from '../src/queue.ts';
let server: any;

describe('index.ts', () => {
  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('responds to GET / with status ok', async () => {
    const res = await request(server).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('queues webhook on configured path', async () => {
    const res = await request(server).post('/testhook').send({ a: 1 });
    expect(res.statusCode).toBe(200);
    expect(addWebhook).toHaveBeenCalledWith('amocrm', { a: 1 });
  });

  it('queues manychat webhook', async () => {
    const res = await request(server).post('/manychat').send({ b: 2 });
    expect(res.statusCode).toBe(200);
    expect(addWebhook).toHaveBeenCalledWith('manychat', { b: 2 });
  });
});
