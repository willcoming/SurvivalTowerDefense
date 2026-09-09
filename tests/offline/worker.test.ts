import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeOfflineWorker, type OfflineSnapshot } from '../../scripts/offline-build';

const template = readFileSync(new URL('../../scripts/offline-worker.js', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

type Status = { type: string; buildId: string; completed: number; total: number; bytesLoaded: number; bytesTotal: number; ready: boolean; error?: string };
type TestEvent = Record<string, unknown> & { waitUntil: (promise: Promise<unknown>) => void };

class MemoryCache {
  readonly responses = new Map<string, Response>();
  quotaExceeded = false;
  async match(url: string) { return this.responses.get(url)?.clone(); }
  async delete(url: string) { return this.responses.delete(url); }
  async put(url: string, response: Response) {
    if (this.quotaExceeded) throw Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });
    this.responses.set(url, response.clone());
  }
}

function fixture(base = '/', buildId = 'build-one') {
  const files = new Map([
    [`${base}index.html`, '<html>offline game</html>'],
    [`${base}assets/game.js`, 'console.log("game");'],
    [`${base}assets/game.css`, 'body { color: white; }'],
    [`${base}assets/never-viewed.webp`, 'complete animation artwork'],
    [`${base}manifest.webmanifest`, '{"name":"game"}'],
    [`${base}icons/icon-512.png`, 'complete icon'],
    [`${base}version.json`, '{"commit":"one"}'],
  ]);
  const entries = [...files].map(([url, content]) => {
    const digest = createHash('sha256').update(content).digest();
    return { url, bytes: Buffer.byteLength(content), sha256: digest.toString('hex'), integrity: `sha256-${digest.toString('base64')}` };
  });
  const snapshot: OfflineSnapshot = { buildId, base, cachePrefix: `starfall-offline-${base === '/' ? 'root' : 'pages'}-`, entries, bytesTotal: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
  return { files, snapshot };
}

function runtime(base = '/', buildId = 'build-one', storage = new Map<string, MemoryCache>()) {
  const { files, snapshot } = fixture(base, buildId);
  const scope = `https://game.example${base}`;
  const cacheName = `${snapshot.cachePrefix}${snapshot.buildId}`;
  const markerUrl = new URL('__offline_complete__', scope).href;
  const messages: Status[] = [];
  const outsideMessages: Status[] = [];
  const listeners = new Map<string, (event: TestEvent) => void>();
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn();
  let online = true;
  let beforeFetch: (() => Promise<void>) | undefined;
  const fetch = vi.fn(async (url: string, _options?: RequestInit) => {
    if (!online) throw new TypeError('Network unavailable');
    if (beforeFetch) await beforeFetch();
    const content = files.get(new URL(url).pathname);
    return new Response(content ?? 'not found', { status: content === undefined ? 404 : 200 });
  });
  const caches = {
    async open(name: string) {
      if (!storage.has(name)) storage.set(name, new MemoryCache());
      return storage.get(name)!;
    },
    async keys() { return [...storage.keys()]; },
    async delete(name: string) { return storage.delete(name); },
  };
  runInNewContext(template.replace('__OFFLINE_SNAPSHOT__', JSON.stringify(snapshot)), {
    self: {
      registration: { scope },
      addEventListener(type: string, listener: (event: TestEvent) => void) { listeners.set(type, listener); },
      skipWaiting,
      clients: {
        claim,
        async matchAll() {
          return [
            { url: scope, postMessage(message: Status) { messages.push(message); } },
            { url: 'https://outside.example/', postMessage(message: Status) { outsideMessages.push(message); } },
          ];
        },
      },
    },
    caches, fetch, URL, Response, Uint8Array, AbortController, setTimeout, clearTimeout, crypto: webcrypto,
  });
  async function dispatch(type: string, fields: Record<string, unknown> = {}) {
    const work: Promise<unknown>[] = [];
    listeners.get(type)!({ ...fields, waitUntil: (promise) => { work.push(promise); } });
    await Promise.all(work);
  }
  async function message(type = 'OFFLINE_STATUS') {
    let result: Status | undefined;
    await dispatch('message', {
      source: { url: scope, postMessage: (value: Status) => { result = value; } },
      data: { type }, ports: [{ postMessage: (value: Status) => { result = value; }, close() {} }],
    });
    return result!;
  }
  async function request(path: string, mode = 'cors', method = 'GET') {
    let response: Promise<Response> | undefined;
    await dispatch('fetch', {
      request: { url: new URL(path, scope).href, mode, method },
      respondWith: (result: Promise<Response>) => { response = result; },
    });
    return response;
  }
  return {
    files, snapshot, storage, cacheName, markerUrl, messages, outsideMessages, claim, skipWaiting, fetch, caches,
    dispatch, message, request,
    setOnline(value: boolean) { online = value; },
    setBeforeFetch(callback: () => Promise<void>) { beforeFetch = callback; },
  };
}

describe('offline build inventory', () => {
  it('hashes every final asset, is deterministic, isolates bases, and ignores deployment/check artifacts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'starfall-offline-unit-'));
    temporaryDirectories.push(directory);
    await mkdir(join(directory, 'assets'));
    await mkdir(join(directory, 'test-results'));
    await Promise.all([
      writeFile(join(directory, 'index.html'), '<html>game</html>'),
      writeFile(join(directory, 'manifest.webmanifest'), '{}'),
      writeFile(join(directory, 'version.json'), '{}'),
      writeFile(join(directory, 'assets', 'never viewed.webp'), 'animation'),
      writeFile(join(directory, 'deployment-receipt.json'), 'private deploy receipt'),
      writeFile(join(directory, 'live-verification.json'), 'verification report'),
      writeFile(join(directory, 'offline-local-verification.json'), 'local verification report'),
      writeFile(join(directory, 'offline-live-verification.json'), 'live verification report'),
      writeFile(join(directory, 'test-results', 'screenshot.png'), 'test screenshot'),
    ]);
    const root = await writeOfflineWorker(directory, '/');
    expect(root.entries.map((entry) => entry.url)).toEqual(['/assets/never%20viewed.webp', '/index.html', '/manifest.webmanifest', '/version.json']);
    expect(root.entries.every((entry) => entry.integrity.startsWith('sha256-') && entry.sha256.length === 64)).toBe(true);
    expect((await writeOfflineWorker(directory, '/')).buildId).toBe(root.buildId);
    const pages = await writeOfflineWorker(directory, '/SurvivalTowerDefense/');
    expect(pages.buildId).not.toBe(root.buildId);
    expect(pages.cachePrefix).not.toBe(root.cachePrefix);
    expect(pages.entries.every((entry) => entry.url.startsWith('/SurvivalTowerDefense/'))).toBe(true);
    expect(JSON.parse((await readFile(join(directory, 'sw.js'), 'utf8')).split('\n')[0].slice('const SNAPSHOT = '.length, -1))).toEqual(pages);
    await writeFile(join(directory, 'assets', 'never viewed.webp'), 'new animation');
    expect((await writeOfflineWorker(directory, '/SurvivalTowerDefense/')).buildId).not.toBe(pages.buildId);
    await expect(writeOfflineWorker(directory, './')).rejects.toThrow('same-origin');
  });
});

describe('complete offline worker', () => {
  for (const base of ['/', '/SurvivalTowerDefense/']) it(`downloads the complete verified snapshot and serves navigation and query assets offline under ${base}`, async () => {
    const worker = runtime(base);
    await worker.dispatch('install');
    await worker.dispatch('activate');
    expect(await worker.message()).toEqual({ type: 'OFFLINE_STATUS', buildId: 'build-one', completed: 7, total: 7, bytesLoaded: worker.snapshot.bytesTotal, bytesTotal: worker.snapshot.bytesTotal, ready: true });
    expect(worker.claim).toHaveBeenCalledOnce();
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect(worker.outsideMessages).toHaveLength(0);
    for (const [url, options] of worker.fetch.mock.calls) {
      expect(options?.cache).toBe('no-store');
      expect(options?.integrity).toBe(worker.snapshot.entries.find((entry) => new URL(url).pathname === entry.url)?.integrity);
    }
    worker.setOnline(false);
    worker.fetch.mockClear();
    expect(await (await worker.request(`${base}?v=revision`, 'navigate'))?.text()).toBe(worker.files.get(`${base}index.html`));
    expect(await (await worker.request(`${base}nested/route`, 'navigate'))?.text()).toBe(worker.files.get(`${base}index.html`));
    expect(await (await worker.request(`${base}assets/never-viewed.webp?cache=bust`))?.text()).toBe('complete animation artwork');
    expect(await worker.request(`${base}unknown.png`)).toBeUndefined();
    expect(await worker.request(`${base}index.html`, 'cors', 'POST')).toBeUndefined();
    expect(await worker.request('https://outside.example/index.html', 'navigate')).toBeUndefined();
    if (base !== '/') expect(await worker.request('/another-game/', 'navigate')).toBeUndefined();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('rejects a mixed deployment, retains the active version, and cleans only its own scope after repaired activation', async () => {
    const old = runtime('/SurvivalTowerDefense/', 'old');
    await old.dispatch('install');
    await old.dispatch('activate');
    old.storage.set('unrelated-cache', new MemoryCache());
    old.storage.set('starfall-offline-root-another-game', new MemoryCache());
    const candidate = runtime('/SurvivalTowerDefense/', 'new', old.storage);
    const path = '/SurvivalTowerDefense/assets/never-viewed.webp';
    candidate.files.set(path, 'changed artwork from another deployment');
    await expect(candidate.dispatch('install')).rejects.toThrow('INTEGRITY');
    expect(await old.message()).toMatchObject({ ready: true, buildId: 'old' });
    expect(await candidate.message()).toMatchObject({ ready: false, error: expect.stringContaining('版本不一致') });
    expect(await (await candidate.caches.open(candidate.cacheName)).match(candidate.markerUrl)).toBeUndefined();
    expect(candidate.claim).not.toHaveBeenCalled();
    candidate.files.set(path, 'complete animation artwork');
    expect(await candidate.message('OFFLINE_REPAIR')).toMatchObject({ ready: true });
    expect(old.storage.has(old.cacheName)).toBe(true);
    await candidate.dispatch('activate');
    expect(old.storage.has(old.cacheName)).toBe(false);
    expect(old.storage.has('unrelated-cache')).toBe(true);
    expect(old.storage.has('starfall-offline-root-another-game')).toBe(true);
  });

  it('reports quota failure without a complete marker and supports explicit retry', async () => {
    const worker = runtime();
    const cache = await worker.caches.open(worker.cacheName);
    cache.quotaExceeded = true;
    await expect(worker.dispatch('install')).rejects.toThrow('Quota exceeded');
    expect(await worker.message()).toMatchObject({ ready: false, error: expect.stringContaining('儲存空間不足') });
    expect(await cache.match(worker.markerUrl)).toBeUndefined();
    cache.quotaExceeded = false;
    expect(await worker.message('OFFLINE_REPAIR')).toMatchObject({ ready: true, completed: 7 });
  });

  it('reports eviction during the waiting phase without claiming clients or deleting previous caches', async () => {
    const worker = runtime();
    worker.storage.set(`${worker.snapshot.cachePrefix}old`, new MemoryCache());
    await worker.dispatch('install');
    const cache = await worker.caches.open(worker.cacheName);
    await cache.delete('https://game.example/assets/never-viewed.webp');
    await worker.dispatch('activate');
    expect(worker.claim).not.toHaveBeenCalled();
    expect(worker.storage.has(`${worker.snapshot.cachePrefix}old`)).toBe(true);
    expect(worker.messages.at(-1)).toMatchObject({ ready: false, completed: 6, error: expect.stringContaining('不完整') });
    expect(await worker.message()).toMatchObject({ ready: false });
  });

  it('detects evicted assets despite the marker and only restores ready after complete repair', async () => {
    const worker = runtime();
    await worker.dispatch('install');
    await worker.dispatch('activate');
    const cache = await worker.caches.open(worker.cacheName);
    await cache.delete('https://game.example/assets/never-viewed.webp');
    worker.setOnline(false);
    expect(await worker.message()).toMatchObject({ ready: false, completed: 6, error: expect.stringContaining('不完整') });
    expect((await worker.request('/assets/never-viewed.webp'))?.status).toBe(503);
    expect(await worker.message('OFFLINE_REPAIR')).toMatchObject({ ready: false });
    worker.setOnline(true);
    worker.fetch.mockClear();
    expect(await worker.message('OFFLINE_REPAIR')).toMatchObject({ ready: true, completed: 7 });
    expect(worker.fetch).toHaveBeenCalledTimes(1);
    expect(await cache.match(worker.markerUrl)).toBeDefined();
  });

  it('bounds downloads to four in flight and never reports ready in intermediate progress', async () => {
    const worker = runtime();
    let inFlight = 0;
    let maximum = 0;
    worker.setBeforeFetch(async () => {
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight--;
    });
    await worker.dispatch('install');
    expect(maximum).toBe(4);
    expect(worker.messages.filter((message) => message.ready)).toHaveLength(1);
    expect(worker.messages.at(-1)).toMatchObject({ ready: true, completed: 7 });
    expect(worker.messages.slice(0, -1).every((message) => !message.ready)).toBe(true);
  });
});
