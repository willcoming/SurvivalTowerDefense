import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CONTENT_VERSION } from '../src/data/content';
import type { GameSave } from '../src/storage/repository';

const productionUrl = new URL(process.env.PRODUCTION_URL ?? 'http://127.0.0.1:5173/');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const session = await context.newCDPSession(page);
await session.send('Network.enable');
await session.send('Network.setCacheDisabled', { cacheDisabled: true });
await session.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 1_250_000, uploadThroughput: 1_250_000, connectionType: 'cellular4g' });
const errors: string[] = [], failed: string[] = [];
const assetRequests = new Set<string>();
page.on('pageerror', e => errors.push(e.message));
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
page.on('request', request => {
  const url = new URL(request.url());
  if (url.protocol.startsWith('http') && url.pathname.includes('/assets/')) assetRequests.add(url.href);
});
const dir = process.env.VALIDATION_OUTPUT_DIR ?? `artifacts/validation/${CONTENT_VERSION}/production`;
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
  await page.goto(productionUrl.href);
  await page.locator('[data-action="intel"]').waitFor();
  const homeInteractiveMs = performance.now() - start;
  const buildCommit = await page.locator('meta[name="build-revision"]').getAttribute('content');
  if (process.env.EXPECTED_COMMIT) assert.equal(buildCommit, process.env.EXPECTED_COMMIT, 'Live page must match the pushed commit');
  const versionUrl = new URL('version.json', productionUrl);
  versionUrl.searchParams.set('v', process.env.EXPECTED_COMMIT ?? String(Date.now()));
  const versionResponse = await context.request.get(versionUrl.href);
  assert.equal(versionResponse.status(), 200);
  const version = await versionResponse.json();
  assert.equal(version.commit, buildCommit, 'HTML and version.json must identify the same build');
  assert.equal(version.contentVersion, CONTENT_VERSION);
  assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string,unknown>).__game), 'undefined', 'Production must not expose development commands');
  await page.screenshot({ path: `${dir}/home.png`, fullPage: true });
  await page.locator('[data-action="intel"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  const battleStart = performance.now();
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 10000 });
  const battleReadyMs = performance.now() - battleStart;
  await page.getByRole('button', { name: '明白，開始防守 →', exact: true }).click();
  const range = page.locator('#range-C02');
  await range.click(); assert.equal(await range.getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#range-info').innerText(), /近程/);
  await range.click(); assert.equal(await range.getAttribute('aria-pressed'), 'false');
  const speed = page.locator('#speed-button');
  assert.equal(await speed.innerText(), '1×');
  await speed.click(); assert.equal(await speed.innerText(), '2×');
  await speed.click(); assert.equal(await speed.innerText(), '3×');
  const auto = page.getByRole('button', { name: '自動施放隊長技能', exact: true });
  assert.equal(await auto.getAttribute('aria-pressed'), 'false');
  await auto.click(); assert.equal(await auto.getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: `${dir}/auto-tactical-battle.png` });
  await page.locator('.deep-panel').waitFor({ timeout: 35000 });
  await page.waitForTimeout(200);
  const before = await readSave();
  assert.ok(before.activeRun?.draft, 'Earned upgrade was saved');
  assert.equal(before.activeRun.contentVersion, CONTENT_VERSION);
  assert.equal(before.preferences.battleSpeed, 3);
  assert.equal(before.preferences.autoTactical, true);
  assert.equal(before.activeRun.stats.casts.length, 0, 'Captain waits for initial cooldown');
  assert.equal(before.activeRun.draft.cards.length, 0);
  assert.equal(before.activeRun.draft.pointTarget, 2);
  await page.locator('[data-action="deep-owner"][data-id="C02"]').click();
  await page.locator('[data-action="deep-node"][data-id="C02-A/0"]').click();
  await page.locator('[data-action="buy-node"]').click();
  await page.waitForTimeout(200);
  const partial = await readSave();assert.equal(partial.activeRun?.choicesSpent,1);
  await page.screenshot({ path: `${dir}/earned-upgrade.png`, fullPage: true });
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 10000 });
  await page.locator('.deep-panel').waitFor();
  await page.waitForTimeout(200);
  const after = await readSave();
  assert.equal(after.activeRun?.runId, partial.activeRun?.runId);
  assert.equal(after.activeRun?.tick, partial.activeRun?.tick);
  assert.deepEqual(after.activeRun?.treeNodes, partial.activeRun?.treeNodes);
  assert.deepEqual(after.activeRun?.draft, partial.activeRun?.draft);
  assert.deepEqual(after.activeRun?.rng, partial.activeRun?.rng);
  assert.deepEqual(after.activeRun?.wavePlan, partial.activeRun?.wavePlan);
  assert.equal(after.preferences.battleSpeed, 3);
  assert.equal(after.preferences.autoTactical, true);
  assert.equal(await auto.getAttribute('aria-pressed'), 'true');
  assert.equal(after.activeRun?.tacticalReadyAt, before.activeRun?.tacticalReadyAt);
  assert.equal(await speed.innerText(), '3×');
  await page.locator('[data-action="deep-owner"][data-id="common"]').click();
  await page.locator('[data-action="deep-node"][data-id="TEAM/0"]').click();
  await page.locator('[data-action="buy-node"]').click();
  if(await page.locator('[data-action="resume"]').count())await page.locator('[data-action="resume"]').click();
  // Continue by ordinary UI choices until the real 50-second cooldown completes.
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    const state=(await readSave()).activeRun;
    if(state?.stats.casts.length)break;
    if(await page.locator('.deep-panel').count()){
      await page.locator('[data-action="deep-owner"][data-id="common"]').click();
      await page.locator('.deep-node.available').first().click();await page.locator('[data-action="buy-node"]').click();
    }
    await page.waitForTimeout(300);
  }
  await page.locator('[data-action="pause"]').click();await page.waitForTimeout(200);
  const chosen = await readSave();
  assert.ok(chosen.activeRun?.choicesSpent!>=2);
  assert.ok(chosen.activeRun?.stats.casts.length,'Auto captain eventually casts');
  assert.ok(chosen.activeRun!.stats.casts[0]>=before.activeRun.tacticalReadyAt,'No early auto cast');
  assert.ok(chosen.activeRun?.pauseReasons.includes('user'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  const assetBaseUrl = new URL('assets/', productionUrl).href;
  assert.ok(assetRequests.size > 0, 'Production must load artwork and bundles');
  assert.ok([...assetRequests].every(url => url.startsWith(assetBaseUrl)), 'All assets must use the deployment base path');
  assert.ok(homeInteractiveMs <= 5000, `Home load ${homeInteractiveMs}ms exceeds 5000ms`);
  assert.ok(battleReadyMs <= 10000, `Battle load ${battleReadyMs}ms exceeds 10000ms`);
  const result = { contentVersion: CONTENT_VERSION, buildCommit, version, measuredAt: new Date().toISOString(), browser: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent), origin: productionUrl.origin, url: productionUrl.href, server: process.env.PRODUCTION_SERVER ?? 'vite preview of production dist', viewport: page.viewportSize(), network: '10 Mbps / 100 ms RTT, empty browser context, HTTP cache disabled', homeInteractiveMs, battleReadyMs, snapshotTick: before.activeRun?.tick, phaseAfterRecovery: chosen.activeRun?.phase, savedChoices: chosen.activeRun?.choicesSpent, battleSpeed: chosen.preferences.battleSpeed, autoTactical: chosen.preferences.autoTactical, actualAutoCasts: chosen.activeRun!.stats.casts.length, initialCooldownTicks: before.activeRun.tacticalReadyAt, firstCastTick: chosen.activeRun!.stats.casts[0], partialPointRecovery: true, productionDebugApiAbsent: true, consoleErrors: errors, failedRequests: failed, assetBaseUrl, assetRequests: [...assetRequests].sort(), passed: true, limitation: 'Desktop Chromium emulating mobile viewport/network; not actual phone hardware. Real-time gameplay earned the first upgrade without simulation hooks.' };
  writeFileSync(`${dir}/smoke.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  writeFileSync(`${dir}/failure.json`, JSON.stringify({ error: String(error), errors, failed, body: await page.locator('body').innerText() }, null, 2));
  throw error;
} finally { await browser.close(); }
