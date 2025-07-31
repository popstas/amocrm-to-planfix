import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unmock('fs');
});

describe('config reload watching', () => {
  it('reloads config when file changes in index.ts', async () => {
    const watchSpy = vi.spyOn(fs, 'watchFile');
    const original = process.argv[1];
    process.argv[1] = fileURLToPath(new URL('../src/index.ts', import.meta.url));
    const configMod = await import('../src/config.ts');
    const loadSpy = vi.spyOn(configMod, 'loadConfig');
    await import('../src/index.ts');
    expect(watchSpy).toHaveBeenCalled();
    const cb = watchSpy.mock.calls[0][1];
    loadSpy.mockClear();
    cb();
    expect(loadSpy).toHaveBeenCalled();
    process.argv[1] = original;
  });

  it('reloads config when file changes in worker.ts', async () => {
    const watchSpy = vi.spyOn(fs, 'watchFile');
    const original = process.argv[1];
    process.argv[1] = fileURLToPath(new URL('../src/worker.ts', import.meta.url));
    const configMod = await import('../src/config.ts');
    const loadSpy = vi.spyOn(configMod, 'loadConfig');
    await import('../src/worker.ts');
    expect(watchSpy).toHaveBeenCalled();
    const cb = watchSpy.mock.calls[0][1];
    loadSpy.mockClear();
    cb();
    expect(loadSpy).toHaveBeenCalled();
    process.argv[1] = original;
  });
});
