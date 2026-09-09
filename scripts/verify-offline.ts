import { chromium, webkit, expect, type BrowserContext, type BrowserType, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { writeOfflineWorker } from './offline-build';
import type { GameSave } from '../src/storage/repository';

interface Snapshot {
  buildId: string;
  base: string;
  cachePrefix: string;
  entries: Array<{ url: string; bytes: number; sha256: string; integrity: string }>;
  bytesTotal: number;
}
interface FixtureServer {
  server: Server;
  url: URL;
  directory: string;
  failedPath: string | null;
  delayedPath: string | null;
  unavailable: boolean;
  requests: Array<{ path: string; status: number }>;
}
const output = resolve(process.env.VALIDATION_OUTPUT_DIR ?? join(tmpdir(), 'starfall-offline-verification'));
mkdirSync(output, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'starfall-offline-'));
const live = process.env.PRODUCTION_URL;
const selectedBrowser = process.env.OFFLINE_BROWSER ?? 'all';
assert.ok(['all', 'chromium', 'webkit'].includes(selectedBrowser));
const selectedScenario = process.env.OFFLINE_SCENARIO ?? 'all';
assert.ok(['all', 'core', 'retry', 'update'].includes(selectedScenario), 'OFFLINE_SCENARIO must be all, core, retry or update');
assert.ok(!live || ['all', 'core'].includes(selectedScenario), 'Live URLs support only core smoke verification');
const dist = resolve(process.env.OFFLINE_DIST_DIR ?? 'dist');
const cases: Array<Record<string, unknown>> = [];
const contexts = new Set<BrowserContext>();
const servers: FixtureServer[] = [];
let currentPage: Page | undefined;
let currentCase = 'startup';

function snapshotFrom(source: string): Snapshot {
  const match = source.match(/^const SNAPSHOT = (.+);\r?$/m);
  assert.ok(match, 'Production sw.js must embed its content-hashed snapshot');
  return JSON.parse(match[1]) as Snapshot;
}
function localSnapshot(directory: string): Snapshot {
  return snapshotFrom(readFileSync(join(directory, 'sw.js'), 'utf8'));
}
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};
async function serve(directory: string, base: string): Promise<FixtureServer> {
  const fixture = { directory, failedPath: null, delayedPath: null, unavailable: false, requests: [] } as unknown as FixtureServer;
  fixture.server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (fixture.unavailable) { fixture.requests.push({ path, status: 0 }); request.socket.destroy(); return; }
    const send = () => {
      const finish = (status: number, body: string | Buffer, contentType: string) => {
        fixture.requests.push({ path, status });
        response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        response.end(body);
      };
      if (!path.startsWith(base) || path.includes('..')) { finish(404, 'Not found', 'text/plain'); return; }
      if (path === fixture.failedPath) { finish(503, 'Intentional offline verification failure', 'text/plain'); return; }
      const relative = decodeURIComponent(path.slice(base.length)) || 'index.html';
      try { finish(200, readFileSync(join(fixture.directory, relative)), mime[extname(relative)] ?? 'application/octet-stream'); }
      catch { finish(404, 'Not found', 'text/plain'); }
    };
    if (path === fixture.delayedPath) setTimeout(send, 1500); else send();
  });
  await new Promise<void>(resolveListen => fixture.server.listen(0, '127.0.0.1', resolveListen));
  const address = fixture.server.address();
  assert.ok(address && typeof address !== 'string');
  fixture.url = new URL(`http://127.0.0.1:${address.port}${base}`);
  servers.push(fixture);
  return fixture;
}
async function launch(engine: BrowserType, profile: string, blockWorkers = false): Promise<BrowserContext> {
  const context = await engine.launchPersistentContext(profile, {
    viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: blockWorkers ? 'block' : 'allow',
  });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  contexts.add(context);
  return context;
}
async function closeContext(context: BrowserContext) {
  await context.close();
  contexts.delete(context);
}
async function track(page: Page, errors: string[] = []): Promise<string[]> {
  currentPage = page;
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}
function state(page: Page, location = 'summary') {
  return page.locator(`[data-offline="${location}"]`);
}
async function ready(page: Page, location = 'summary') {
  await expect(state(page, location)).toHaveAttribute('data-offline-state', 'ready', { timeout: 90000 });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'Ready must mean this page has an active offline controller');
  await expect(state(page, location).locator(`[data-offline-field="${location === 'summary' ? 'summary' : 'title'}"]`)).toContainText('可離線遊玩');
}
async function home(page: Page) {
  await page.locator('.game-dock [data-action="home"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-page', 'home');
}
async function readSave(page: Page): Promise<GameSave | undefined> {
  return page.evaluate(() => new Promise<GameSave | undefined>((resolveSave, reject) => {
    const open = indexedDB.open('starfall-defense', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('records', 'readonly').objectStore('records').get('save');
      request.onsuccess = () => { database.close(); resolveSave(request.result); };
      request.onerror = () => { database.close(); reject(request.error); };
    };
  }));
}
async function allAssetsOffline(page: Page, snapshot: Snapshot, cacheOnly = false) {
  const result = await page.evaluate(async ({ entries, cacheName }) => {
    const cache = cacheName ? await caches.open(cacheName) : undefined;
    const failures: string[] = [];
    let verifiedBytes = 0;
    for (let offset = 0; offset < entries.length; offset += 8) {
      await Promise.all(entries.slice(offset, offset + 8).map(async entry => {
        try {
          const response = cache ? await cache.match(entry.url) : await fetch(entry.url, { cache: 'no-store' });
          if (!response) throw new Error('Missing cached asset');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
          if (hash !== entry.sha256 || bytes.byteLength !== entry.bytes) throw new Error('Content or size differs from snapshot');
          verifiedBytes += bytes.byteLength;
        } catch (error) { failures.push(`${entry.url}: ${String(error)}`); }
      }));
    }
    return { failures, verifiedBytes, verifiedEntries: entries.length };
  }, { entries: snapshot.entries, cacheName: cacheOnly ? `${snapshot.cachePrefix}${snapshot.buildId}` : null });
  assert.deepEqual(result.failures, [], cacheOnly ? 'Every precached asset must have correct bytes' : 'Every bundled asset, including unvisited art, must load with correct bytes offline');
  assert.equal(result.verifiedBytes, snapshot.bytesTotal);
  return result;
}
async function setViewportAndSettle(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.waitForFunction(({ width, height }) =>
    innerWidth === width && innerHeight === height &&
    matchMedia('(max-width: 800px)').matches === (width <= 800) &&
    document.querySelector('#app')?.classList.contains('mobile-app'), viewport);
  // WebKit may deliver matchMedia change after setViewportSize resolves. GameApp
  // rebuilds its screen then; wait for that DOM to remain stable across frames
  // before interacting with inputs whose changes are committed on blur.
  await page.evaluate(async () => {
    let previous = document.querySelector('#app')?.firstElementChild;
    let stableFrames = 0;
    const deadline = performance.now() + 3000;
    while (stableFrames < 3) {
      await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame()));
      const current = document.querySelector('#app')?.firstElementChild;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (performance.now() > deadline) throw new Error('Responsive screen did not settle after viewport resize');
    }
  });
}

async function layout(page: Page, name: string) {
  for (const width of [320, 768, 1024, 1440]) {
    await setViewportAndSettle(page, { width, height: width === 320 ? 568 : 1000 });
    const sizes = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
    assert.ok(sizes.scrollWidth <= sizes.width + 1, `${name} overflows horizontally at ${width}: ${JSON.stringify(sizes)}`);
    assert.ok(sizes.scrollHeight <= sizes.height + 1, `${name} overflows the game stage at ${width}: ${JSON.stringify(sizes)}`);
    if (/settings|download-error/.test(name)) await state(page, 'settings').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: join(output, `${name}-${width}.png`), fullPage: true });
  }
  await setViewportAndSettle(page, { width: 390, height: 844 });
}
async function startBattle(page: Page) {
  await page.bringToFront();
  await page.locator('.deploy-button').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 30000 });
  await expect(page.locator('#app')).toHaveAttribute('data-page', 'battle');
  const tutorial = page.locator('[data-action="tutorial-done"]');
  if (await tutorial.count()) await tutorial.first().click();
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
}
async function coreSmoke(engine: BrowserType, name: string, url: URL, snapshot: Snapshot, fixture?: FixtureServer) {
  currentCase = `${name}-offline-core`;
  console.log(`Checking ${currentCase} at ${url.href}`);
  const profile = join(work, `${name}-profile`);
  const transportCutoff = name === 'webkit' && !!fixture;
  const disconnect = async (browserContext: BrowserContext) => {
    if (transportCutoff) fixture!.unavailable = true;
    else await browserContext.setOffline(true);
  };
  let context = await launch(engine, profile);
  let page = context.pages()[0] ?? await context.newPage();
  const errors = await track(page);
  if (fixture) fixture.delayedPath = snapshot.entries.find(entry => entry.url.includes('/animations/'))?.url ?? null;
  await page.goto(url.href);
  await expect(page.locator('#app')).toHaveAttribute('data-page', 'home');
  assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).__game), 'undefined');
  const commit = await page.locator('meta[name="build-revision"]').getAttribute('content');
  if (process.env.EXPECTED_COMMIT) assert.equal(commit, process.env.EXPECTED_COMMIT);
  if (fixture) {
    await expect(state(page)).toHaveAttribute('data-offline-state', 'downloading', { timeout: 15000 });
    await page.screenshot({ path: join(output, `${name}-downloading.png`) });
  }
  await ready(page);
  if (fixture) fixture.delayedPath = null;
  await layout(page, `${name}-home-ready`);
  if (name === 'chromium') {
    const session = await context.newCDPSession(page);
    await session.send('Page.enable');
    await Promise.all([page.waitForEvent('load'), session.send('Page.reload', { ignoreCache: true })]);
    await expect(state(page)).toHaveAttribute('data-offline-state', 'downloaded', { timeout: 30000 });
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false, 'Hard reload bypasses the controller, so it must not claim offline readiness');
    const documentTime = await page.evaluate(() => performance.timeOrigin);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentTime, 'Downloaded state must not force a reload');
    await page.screenshot({ path: join(output, 'chromium-hard-reload-downloaded.png') });
    const blank = await context.newPage();
    await page.close();
    page = await context.newPage();
    await track(page, errors);
    await page.goto(url.href);
    await ready(page);
    await blank.close();
  }
  await disconnect(context);
  if (transportCutoff) {
    await assert.rejects(context.request.get(new URL('__network_cutoff_probe__', url).href, { timeout: 3000 }), 'The fixture must reject network access at the socket level');
    assert.ok(fixture!.requests.some(request => request.status === 0));
  }
  const assets = await allAssetsOffline(page, snapshot);
  await page.reload();
  await ready(page);
  await state(page).focus();
  await page.keyboard.press('Enter');
  await ready(page, 'settings');
  await layout(page, `${name}-settings-ready`);
  await page.locator('#commander-name').fill('離線驗證');
  await expect(page.locator('#commander-name')).toHaveValue('離線驗證');
  await page.locator('#commander-name').press('Tab');
  await expect(page.locator('#commander-name')).toHaveValue('離線驗證');
  await expect.poll(async () => (await readSave(page))?.preferences.commanderName).toBe('離線驗證');
  await page.locator('#reduced').check();
  await expect.poll(async () => (await readSave(page))?.preferences.reducedEffects).toBe(true);
  await page.locator('.game-dock [data-action="roster"]').click();
  await page.locator('[data-action="roster-edit"]').first().click();
  await page.locator('.roster-tile[data-id="C05"]').click();
  await page.locator('[data-action="toggle-character"][data-id="C05"]').click();
  await page.locator('[data-action="roster-close"]').click();
  await page.locator('[data-action="roster-commit"]').click();
  await expect.poll(async () => (await readSave(page))?.preferences.squadIds.includes('C05')).toBe(false);
  await closeContext(context);
  // Seed only an isolated browser profile, with all game writers closed. The empty
  // routed page never loads app code and workers are blocked during the transaction.
  const seedContext = await launch(engine, profile, true);
  const seedPage = seedContext.pages()[0] ?? await seedContext.newPage();
  await seedPage.route(url.href, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated offline test fixture</title>' }));
  await seedPage.goto(url.href);
  await seedPage.evaluate(() => new Promise<void>((resolveSeed, reject) => {
    const open = indexedDB.open('starfall-defense', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      const get = store.get('save');
      get.onsuccess = () => { const save = get.result as GameSave; save.collection.tickets = 1; save.revision++; store.put(save, 'save'); };
      transaction.oncomplete = () => { database.close(); resolveSeed(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }));
  await closeContext(seedContext);
  context = await launch(engine, profile);
  await disconnect(context);
  page = context.pages()[0] ?? await context.newPage();
  await track(page, errors);
  await page.goto(url.href);
  await ready(page);
  await page.locator('.game-dock [data-action="recruitment"]').click();
  await expect(page.locator('.recruit-item')).toHaveCount(10);
  const beforeDraw = await readSave(page);
  assert.ok(beforeDraw);
  assert.equal(beforeDraw.collection.tickets, 1);
  await page.locator('[data-action="draw"]').click();
  await expect(page.locator('.recruitment-receipt')).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.collection.sequence).toBe(beforeDraw.collection.sequence + 1);
  const drawn = await readSave(page);
  assert.ok(drawn?.collection.lastReceipt);
  assert.equal(drawn.collection.tickets, 0);
  assert.equal(drawn.collection.lastReceipt.kind, 'draw');
  assert.equal(drawn.collection.lastReceipt.spent, 'ticket');
  assert.ok(drawn.collection.owned.includes(drawn.collection.lastReceipt.formId));
  const preview = page.locator('.recruit-card-grid [data-action="recruit-preview"]').last();
  await preview.scrollIntoViewIfNeeded();
  await preview.click();
  await expect.poll(() => page.getByRole('dialog').locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: join(output, `${name}-offline-recruit-art.png`) });
  await page.getByRole('button', { name: '關閉大圖' }).click();
  await layout(page, `${name}-offline-recruitment`);
  await home(page);
  await startBattle(page);
  const initialBattleTime = await page.locator('#time-text').innerText();
  await page.locator('#speed-button').click();
  await page.locator('#speed-button').click();
  await expect(page.locator('#speed-button')).toHaveText('3×');
  await expect.poll(async () => (await readSave(page))?.preferences.battleSpeed).toBe(3);
  await expect(page.locator('#time-text')).not.toHaveText(initialBattleTime, { timeout: 10000 });
  await page.locator('[data-action="pause"]').click();
  await expect(page.locator('.pause-dialog')).toBeVisible();
  await page.screenshot({ path: join(output, `${name}-offline-battle.png`) });
  const before = await readSave(page);
  assert.ok(before, 'Permanent preferences must be saved during offline battle');
  assert.equal(before.activeRun, null, 'Battle snapshots must not be persisted');
  // Closing the persistent browser proves startup does not depend on in-memory page state or its HTTP cache.
  await closeContext(context);
  context = await launch(engine, profile);
  await disconnect(context);
  page = context.pages()[0] ?? await context.newPage();
  await track(page, errors);
  await page.goto(url.href);
  await ready(page);
  await expect(page.locator('#app')).toHaveAttribute('data-page', 'home');
  const after = await readSave(page);
  assert.ok(after);
  assert.equal(after.activeRun, null, 'Unfinished battle ends when the game is reopened');
  assert.deepEqual(after.preferences, before.preferences, 'Settings and formation survive offline browser restart');
  assert.deepEqual(after.collection, before.collection, 'Collection survives offline browser restart');
  assert.deepEqual(after.profile, before.profile, 'Permanent progress survives offline browser restart');
  await startBattle(page);
  await expect(page.locator('#speed-button')).toHaveText('3×');
  assert.deepEqual(errors, []);
  cases.push({ name: currentCase, passed: true, commit, buildId: snapshot.buildId, ...assets, widths: [320, 768, 1024, 1440], persistentBrowserRestart: true, productionDebugApiAbsent: true, offlineVerified: true, hardReloadTruthfulState: name === 'chromium', blockedSocketRequests: fixture?.requests.filter(request => request.status === 0).length ?? null, offlineMethod: transportCutoff ? 'Every fixture server socket destroyed; navigator remains online' : 'Browser network offline emulation', recruitment: { realOfflineDraw: true, isolatedFixtureTickets: 1, receipt: drawn.collection.lastReceipt }, savedPreferences: after.preferences });
  await closeContext(context);
  if (fixture) fixture.unavailable = false;
}

async function webkitLiveCompatibility(url: URL, snapshot: Snapshot) {
  currentCase = 'webkit-live-online-compatibility';
  console.log(`Checking ${currentCase} at ${url.href}`);
  const context = await launch(webkit, join(work, 'webkit-live-profile'));
  const page = context.pages()[0] ?? await context.newPage();
  const errors = await track(page);
  await page.goto(url.href);
  await ready(page);
  assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).__game), 'undefined');
  const commit = await page.locator('meta[name="build-revision"]').getAttribute('content');
  if (process.env.EXPECTED_COMMIT) assert.equal(commit, process.env.EXPECTED_COMMIT);
  const cachedAssets = await allAssetsOffline(page, snapshot, true);
  await state(page).focus();
  await page.keyboard.press('Enter');
  await ready(page, 'settings');
  await layout(page, 'webkit-live-settings');
  assert.deepEqual(errors, []);
  cases.push({ name: currentCase, passed: true, commit, buildId: snapshot.buildId, ...cachedAssets, offlineVerified: false, limitation: 'WebKit offline emulation blocks Service Worker fetches. Local production tests prove offline behavior using destroyed server sockets; a remote live server cannot be cut off by this verifier.' });
  await closeContext(context);
}

async function retryAndRepair(snapshot: Snapshot) {
  currentCase = 'initial-failure-retry-and-cache-repair';
  console.log(`Checking ${currentCase}`);
  const fixture = await serve(dist, snapshot.base);
  const lateAsset = snapshot.entries.find(entry => entry.url.includes('/animations/C08-')) ?? snapshot.entries.find(entry => entry.url.endsWith('.webp'));
  assert.ok(lateAsset);
  fixture.failedPath = lateAsset.url;
  const context = await launch(chromium, join(work, 'retry-profile'));
  const page = context.pages()[0] ?? await context.newPage();
  await track(page);
  await page.goto(fixture.url.href);
  await expect(state(page)).toHaveAttribute('data-offline-state', 'error', { timeout: 90000 });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false, 'Partial first download must never take control');
  await state(page).click();
  await expect(state(page, 'settings')).toHaveAttribute('data-offline-state', 'error');
  await layout(page, 'chromium-initial-download-error');
  fixture.failedPath = null;
  await page.locator('[data-offline-action="retry"]').click();
  await ready(page, 'settings');
  await home(page);
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  const removed = await page.evaluate(async ({ prefix, asset }) => {
    let deleted = 0;
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) if (new URL(request.url).pathname === asset && await cache.delete(request)) deleted++;
    }
    return deleted;
  }, { prefix: snapshot.cachePrefix, asset: lateAsset.url });
  assert.ok(removed > 0, 'Cache corruption fixture must remove a real installed asset');
  await page.reload();
  await expect(state(page)).toHaveAttribute('data-offline-state', 'error', { timeout: 90000 });
  await state(page).click();
  await page.screenshot({ path: join(output, 'chromium-incomplete-cache.png') });
  await context.setOffline(false);
  await page.locator('[data-offline-action="retry"]').click();
  await ready(page, 'settings');
  await context.setOffline(true);
  const assets = await allAssetsOffline(page, snapshot);
  assert.ok(fixture.requests.some(request => request.path === lateAsset.url && request.status === 503));
  cases.push({ name: currentCase, passed: true, failedAsset: lateAsset.url, corruptedEntries: removed, ...assets });
  await closeContext(context);
}

async function updateSafety(snapshot: Snapshot) {
  currentCase = 'atomic-update-with-active-battle-and-multiple-tabs';
  console.log(`Checking ${currentCase}`);
  const candidate = join(work, 'candidate-dist');
  cpSync(dist, candidate, { recursive: true });
  const htmlPath = join(candidate, 'index.html');
  const originalHtml = readFileSync(htmlPath, 'utf8');
  const scriptPath = originalHtml.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  assert.ok(scriptPath, 'Candidate fixture needs the real generated entry bundle');
  const bundlePath = join(candidate, scriptPath.slice(snapshot.base.length));
  writeFileSync(bundlePath, `${readFileSync(bundlePath, 'utf8')}\n;document.documentElement.dataset.offlineFixture='candidate-b';\n`);
  writeFileSync(htmlPath, originalHtml.replace(/(<meta name="build-revision" content=")[^"]+("\s*\/?>)/, '$1offline-candidate-b$2'));
  const newer = await writeOfflineWorker(candidate, snapshot.base);
  assert.notEqual(newer.buildId, snapshot.buildId, 'Candidate must have genuinely changed hashed content');
  const fixture = await serve(dist, snapshot.base);
  const context = await launch(chromium, join(work, 'update-profile'));
  const first = context.pages()[0] ?? await context.newPage();
  await track(first);
  await first.goto(fixture.url.href);
  await ready(first);
  await first.evaluate(async () => { await (await caches.open('offline-verifier-unrelated')).put('/unrelated-test-resource', new Response('keep')); });
  const second = await context.newPage();
  await second.goto(fixture.url.href);
  await ready(second);
  await startBattle(first);
  await first.locator('[data-action="pause"]').click();
  const before = await readSave(first);
  assert.ok(before);
  const pausedBattleTime = await first.locator('#time-text').innerText();
  const documentToken = await first.evaluate(() => performance.timeOrigin);
  await second.bringToFront();
  fixture.directory = candidate;
  fixture.failedPath = scriptPath;
  await second.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect(state(second)).toHaveAttribute('data-offline-update', 'error', { timeout: 90000 });
  await ready(second);
  assert.equal(await first.evaluate(() => performance.timeOrigin), documentToken, 'Failed update must not reload active battle');
  await expect(first.locator('#app')).toHaveAttribute('data-page', 'battle');
  await expect(first.locator('#time-text')).toHaveText(pausedBattleTime);
  await context.setOffline(true);
  const oldAssets = await allAssetsOffline(second, snapshot);
  fixture.failedPath = null;
  await context.setOffline(false);
  await state(second).click();
  // Reconnecting automatically retries a failed update; the earlier scenario verifies the manual button.
  await expect(state(second, 'settings')).toHaveAttribute('data-offline-update', 'waiting', { timeout: 90000 });
  await ready(second, 'settings');
  await expect.poll(() => second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  assert.equal(await first.evaluate(() => performance.timeOrigin), documentToken, 'Successful background update must not reload active battle');
  await expect(first.locator('#app')).toHaveAttribute('data-page', 'battle');
  await expect(first.locator('#time-text')).toHaveText(pausedBattleTime);
  await first.close();
  await expect.poll(() => second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  await second.reload();
  await ready(second, 'summary');
  assert.equal(await second.evaluate(() => document.documentElement.dataset.offlineFixture), undefined, 'Remaining old tab must retain the previous JS bundle');
  await expect.poll(() => second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  await second.screenshot({ path: join(output, 'chromium-update-waiting.png') });
  // Keep a blank browser tab alive while closing every client within the game scope.
  const blank = await context.newPage();
  await second.close();
  await blank.waitForTimeout(1500);
  const reopened = await context.newPage();
  await track(reopened);
  await context.setOffline(true);
  await reopened.goto(fixture.url.href);
  await ready(reopened);
  await expect.poll(() => reopened.evaluate(() => document.documentElement.dataset.offlineFixture)).toBe('candidate-b');
  const newAssets = await allAssetsOffline(reopened, newer);
  const survivingCaches = await reopened.evaluate(async prefix => (await caches.keys()).filter(name => name.startsWith(prefix)), snapshot.cachePrefix);
  assert.ok(survivingCaches.every(name => !name.includes(snapshot.buildId)), 'Activation must remove the old game snapshot only');
  assert.equal(await reopened.evaluate(async () => (await (await caches.open('offline-verifier-unrelated')).match('/unrelated-test-resource'))?.text()), 'keep', 'Game update must preserve unrelated application caches');
  const after = await readSave(reopened);
  assert.ok(after);
  assert.deepEqual(after.collection, before.collection);
  assert.deepEqual(after.preferences, before.preferences);
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.activeRun, null);
  cases.push({ name: currentCase, passed: true, oldBuild: snapshot.buildId, newBuild: newer.buildId, failedCandidateRetainedOldAssets: oldAssets.verifiedEntries, newAssets: newAssets.verifiedEntries, battlePreservedUntilClose: true, activationAfterAllGameTabsClose: true, survivingCaches });
  await closeContext(context);
}

try {
  const snapshot = live
    ? snapshotFrom(await (await fetch(new URL('sw.js', live))).text())
    : localSnapshot(dist);
  if (process.env.PAGES_BASE_PATH) assert.equal(snapshot.base, process.env.PAGES_BASE_PATH, 'Build and verification deployment base must match');
  const fixture = live ? undefined : await serve(dist, snapshot.base);
  const url = live ? new URL(live) : fixture!.url;
  assert.equal(url.pathname, snapshot.base, 'Verify the exact installed scope URL');
  if (['all', 'core'].includes(selectedScenario) && selectedBrowser !== 'webkit') await coreSmoke(chromium, 'chromium', url, snapshot, fixture);
  if (!live && selectedBrowser !== 'webkit' && ['all', 'retry'].includes(selectedScenario)) await retryAndRepair(snapshot);
  if (!live && selectedBrowser !== 'webkit' && ['all', 'update'].includes(selectedScenario)) await updateSafety(snapshot);
  if (['all', 'core'].includes(selectedScenario) && selectedBrowser !== 'chromium') try {
    if (live) await webkitLiveCompatibility(url, snapshot);
    else await coreSmoke(webkit, 'webkit', url, snapshot, fixture);
  } catch (error) {
    if (/Executable doesn't exist|browserType\.launch.*not supported/.test(String(error))) {
      cases.push({ name: 'webkit-offline-core', skipped: true, reason: String(error) });
    } else throw error;
  }
  const result = { passed: true, selectedScenario, selectedBrowser, checkedAt: new Date().toISOString(), url: url.href, base: snapshot.base, output, cases, limitations: ['Desktop browser automation; iPhone/iPad and Android home-screen installation require real-device acceptance.', 'Recruitment draw uses one ticket seeded in an isolated test profile while all game writers are closed; it does not claim the ticket was earned by gameplay.', ...(live ? ['Published URL smoke uses isolated profiles and read-only HTTP requests; controlled failure and update scenarios run only against local production fixtures.'] : [])] };
  writeFileSync(join(output, 'summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
    writeFileSync(join(output, 'failure-body.txt'), await currentPage.locator('body').innerText().catch(() => 'Page unavailable'));
  }
  writeFileSync(join(output, 'summary.json'), JSON.stringify({ passed: false, currentCase, error: String(error), stack: error instanceof Error ? error.stack : undefined, cases }, null, 2));
  throw error;
} finally {
  await Promise.allSettled([...contexts].map(context => context.close()));
  await Promise.allSettled(servers.map(fixture => new Promise<void>(resolveClose => { fixture.server.closeAllConnections(); fixture.server.close(() => resolveClose()); })));
  rmSync(work, { recursive: true, force: true });
}
