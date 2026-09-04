import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CONTENT_VERSION } from '../src/data/content';
import type { GameSave } from '../src/storage/repository';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const session = await context.newCDPSession(page);
await session.send('Network.enable');
await session.send('Network.setCacheDisabled', { cacheDisabled: true });
await session.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 1_250_000, uploadThroughput: 1_250_000, connectionType: 'cellular4g' });
const errors: string[] = [], failed: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
const dir = `artifacts/validation/${CONTENT_VERSION}/production`;
mkdirSync(dir, { recursive: true });
async function readSave(): Promise<GameSave> {
  return page.evaluate(() => new Promise<GameSave>((resolve, reject) => {
    const open = indexedDB.open('starfall-defense', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction('records', 'readonly').objectStore('records').get('save');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}
try {
  const start = performance.now();
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('[data-action="intel"]').waitFor();
  const homeInteractiveMs = performance.now() - start;
  assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string,unknown>).__game), 'undefined', 'Production must not expose development commands');
  await page.screenshot({ path: `${dir}/home.png`, fullPage: true });
  await page.locator('[data-action="intel"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  const battleStart = performance.now();
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 10000 });
  const battleReadyMs = performance.now() - battleStart;
  await page.getByRole('button', { name: '明白，開始防守 →', exact: true }).click();
  await page.locator('[data-action="cast"]').click();
  await page.locator('.upgrade-dialog').waitFor({ timeout: 35000 });
  await page.waitForTimeout(200);
  const before = await readSave();
  assert.ok(before.activeRun?.draft, 'Earned upgrade was saved');
  await page.screenshot({ path: `${dir}/earned-upgrade.png`, fullPage: true });
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 10000 });
  await page.locator('[data-action="resume"]').click();
  await page.locator('.upgrade-dialog').waitFor();
  await page.waitForTimeout(200);
  const after = await readSave();
  assert.equal(after.activeRun?.runId, before.activeRun?.runId);
  assert.equal(after.activeRun?.tick, before.activeRun?.tick);
  assert.deepEqual(after.activeRun?.draft, before.activeRun?.draft);
  assert.deepEqual(after.activeRun?.rng, before.activeRun?.rng);
  await page.locator('.upgrade-card').first().click();
  await page.locator('[data-action="confirm-card"]').click();
  await page.locator('[data-action="pause"]').click();
  await page.waitForTimeout(200);
  const chosen = await readSave();
  assert.equal(chosen.activeRun?.choicesSpent, (before.activeRun?.choicesSpent ?? 0) + 1);
  assert.ok(chosen.activeRun?.pauseReasons.includes('user'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  assert.ok(homeInteractiveMs <= 5000, `Home load ${homeInteractiveMs}ms exceeds 5000ms`);
  assert.ok(battleReadyMs <= 10000, `Battle load ${battleReadyMs}ms exceeds 10000ms`);
  const result = { contentVersion: CONTENT_VERSION, measuredAt: new Date().toISOString(), browser: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent), origin: 'http://127.0.0.1:5173', server: 'vite preview of production dist', viewport: page.viewportSize(), network: '10 Mbps / 100 ms RTT, empty browser context, HTTP cache disabled', homeInteractiveMs, battleReadyMs, snapshotTick: before.activeRun?.tick, phaseAfterRecovery: chosen.activeRun?.phase, savedChoices: chosen.activeRun?.choicesSpent, productionDebugApiAbsent: true, consoleErrors: errors, failedRequests: failed, passed: true, limitation: 'Desktop Chromium emulating mobile viewport/network; not actual phone hardware. Real-time gameplay earned the first upgrade without simulation hooks.' };
  writeFileSync(`${dir}/smoke.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  writeFileSync(`${dir}/failure.json`, JSON.stringify({ error: String(error), errors, failed, body: await page.locator('body').innerText() }, null, 2));
  throw error;
} finally { await browser.close(); }
