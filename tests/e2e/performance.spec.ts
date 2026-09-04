import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CONTENT_VERSION } from '../../src/data/content';
function sourceFiles(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(resolve(dir, entry.name)) : [resolve(dir, entry.name)]).sort(); }
test.beforeEach(async ({ page }) => { await page.routeWebSocket('**/*', socket => socket.close()); });
test.use({ trace: 'off' });

test('PERF01: desktop Chromium 60s synthetic render pressure, separately labeled from real-phone verification', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One measured desktop stress environment; this is not mobile hardware evidence.');
  test.setTimeout(90000);
  const sourceDigest = createHash('sha256').update(JSON.stringify(sourceFiles(resolve('src')).map(path => [path.replace(`${process.cwd()}/`, ''), readFileSync(path, 'utf8')]))).digest('hex');
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
  await page.locator('[data-action="intel"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 30000 });
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
  await page.addStyleTag({ content: '.modal-backdrop{display:none!important}' });
  const fixture = await page.evaluate(async () => {
    const modulePath = '/src/sim/combat.ts';
    const { createEnemy } = await import(modulePath);
    const state = window.__game.state()!;
    // Deliberately synthetic pressure fixture. No balance/progression claim is derived from these mutations.
    state.enemies = []; state.fields = []; state.projectiles = [];
    for (let i = 0; i < 120; i++) createEnemy(state, i === 119 ? 'B01' : i % 2 ? 'E02' : 'E01', 37 + i % 10 * 34, 38 + Math.floor(i / 10) * 32, 0, 9);
    for (let i = 0; i < 400; i++) state.projectiles.push({ id: state.nextEntityId++, x: 20 + i % 20 * 18, y: 30 + Math.floor(i / 20) * 21, tx: 195, ty: 200, vx: 0, vy: 0, expires: 999999, hitIds: [], remaining: 1, falloff: [1], radius: 4, blastRadius: 0, packet: { source: 'C01', skill: 'stress', raw: 1, damageType: 'plasma', armorIgnore: 0, shieldMultiplier: 1 }, enemyDamage: 0, enemySource: null, impactAt: 0 });
    for (let i = 0; i < 12; i++) state.fields.push({ id: state.nextEntityId++, source: i % 2 ? 'C04' : 'C05', kind: i % 2 ? 'gravity' : 'fire', x: 65 + i % 3 * 120, y: 80 + Math.floor(i / 3) * 95, radius: 45, expires: 999999, nextTick: 999999, dps: 1, damageType: 'thermal', slow: 0, slowDuration: 0, pull: 0, burnDuration: 0, armorIgnore: 0 });
    for (const w of state.weapons.slice(0, 3)) { w.branch = 'A'; w.rank = 3; }
    state.evolvedCount = 3;
    state.enemies.at(-1)!.chargeKind = 'boss'; state.enemies.at(-1)!.chargeUntil = 999999;
    return { enemies: state.enemies.length, visibleProjectiles: state.projectiles.length, fields: state.fields.length, bossId: 'B01', stageId: state.config.stageId, pausedSimulation: true };
  });
  await page.waitForTimeout(500);
  const frames = await page.evaluate(() => new Promise<number[]>(resolve => {
    const values: number[] = []; let previous = performance.now(); const start = previous;
    function record(now: number) { values.push(now - previous); previous = now; if (now - start >= 60000) resolve(values); else requestAnimationFrame(record); }
    requestAnimationFrame(record);
  }));
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * .95)];
  const artifact = { contentVersion: CONTENT_VERSION, sourceDigest, measuredAt: new Date().toISOString(), browser: info.project.name, browserVersion: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), fixture, tracingEnabled: false, durationMs: frames.reduce((n, t) => n + t, 0), samples: frames.length, p95FrameTimeMs: p95, maxFrameTimeMs: sorted.at(-1), gateReferenceMs: 33.3, desktopRenderPassed: p95 <= 33.3, limitation: 'Synthetic paused logic, active Phaser render. Desktop headless Chromium only; not a real iPhone/Android GPU or live combat logic performance result. Playwright tracing disabled during measurement; screenshot taken afterward.', frameTimesMs: frames };
  mkdirSync(`artifacts/validation/${CONTENT_VERSION}/browser-results`, { recursive: true });
  writeFileSync(`artifacts/validation/${CONTENT_VERSION}/browser-results/desktop-render-performance.json`, JSON.stringify(artifact, null, 2));
  await page.screenshot({ path: `artifacts/validation/${CONTENT_VERSION}/screenshots/desktop-render-stress.png` });
  expect(fixture).toEqual({ enemies: 120, visibleProjectiles: 400, fields: 12, bossId: 'B01', stageId: 'S01', pausedSimulation: true });
  expect(frames.length).toBeGreaterThan(1000);
  expect(p95).toBeLessThanOrEqual(33.3);
});
