import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { arch, cpus, platform, release } from 'node:os';
import { buildPlan } from '../helpers/deep-build';
import { CONTENT_VERSION } from '../../src/data/content';
const output = process.env.VALIDATION_OUTPUT_DIR ?? `artifacts/validation/${CONTENT_VERSION}`;
function sourceFiles(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(resolve(dir, entry.name)) : [resolve(dir, entry.name)]).sort(); }
test.beforeEach(async ({ page }) => { await page.routeWebSocket('**/*', socket => socket.close()); });
test.use({ trace: 'off' });

for (const dynamic of [false, true]) test(`PERF01: desktop Chromium 60s ${dynamic ? 'dynamic' : 'paused'} synthetic render pressure, separately labeled from real-phone verification`, async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One measured desktop stress environment; this is not mobile hardware evidence.');
  test.setTimeout(90000);
  const sourceDigest = createHash('sha256').update(JSON.stringify(sourceFiles(resolve('src')).map(path => [path.replace(`${process.cwd()}/`, ''), readFileSync(path, 'utf8')]))).digest('hex');
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(squadIds=>window.__game.start({stageId:'S01',squadIds,captainId:'C01',seed:101}),buildPlan('C01-A/9',5).squad);
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 30000 });
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
  await page.addStyleTag({ content: '.modal-backdrop{display:none!important}' });
  const fixture = await page.evaluate(async plan => {
    const modulePath = '/src/sim/combat.ts';
    const { createEnemy } = await import(modulePath);
    const state = window.__game.state()!;
    // Deliberately synthetic pressure fixture. No balance/progression claim is derived from these mutations.
    state.enemies = []; state.fields = []; state.projectiles = [];
    for (let i = 0; i < 120; i++) createEnemy(state, i === 119 ? 'B01' : i % 2 ? 'E02' : 'E01', 37 + i % 10 * 34, 38 + Math.floor(i / 10) * 32, 0, 9);
    for (let i = 0; i < 400; i++) state.projectiles.push({ id: state.nextEntityId++, x: 20 + i % 20 * 18, y: 30 + Math.floor(i / 20) * 21, tx: 195, ty: 200, vx: 0, vy: 0, expires: 999999, hitIds: [], remaining: 1, falloff: [1], radius: 4, blastRadius: 0, packet: { source: 'C01', skill: 'stress', raw: 1, damageType: 'plasma', armorIgnore: 0, shieldMultiplier: 1 }, enemyDamage: 0, enemySource: null, impactAt: 0 });
    for (let i = 0; i < 12; i++) state.fields.push({ id: state.nextEntityId++, source: i % 2 ? 'C04' : 'C05', kind: i % 2 ? 'gravity' : 'fire', x: 65 + i % 3 * 120, y: 80 + Math.floor(i / 3) * 95, radius: 45, expires: 999999, nextTick: 999999, dps: 1, damageType: 'thermal', slow: 0, slowDuration: 0, pull: 0, burnDuration: 0, armorIgnore: 0 });
    const enginePath='/src/sim/engine.ts',draftPath='/src/sim/draft.ts';const {command}=await import(enginePath),{openDraft}=await import(draftPath);
    command(state,{type:'pause',reason:'user'});command(state,{type:'resume',reason:'tutorial'});
    state.xp=720;state.choicesEarned=24;openDraft(state);
    for(const nodeId of plan)if(!command(state,{type:'buy-node',offerId:state.draft!.id,nodeId}))throw new Error('Invalid render fixture');
    state.enemies.at(-1)!.chargeKind = 'boss'; state.enemies.at(-1)!.chargeUntil = 999999;
    return { enemies: state.enemies.length, visibleProjectiles: state.projectiles.length, fields: state.fields.length, bossId: 'B01', stageId: state.config.stageId, pausedSimulation: true };
  },buildPlan('C01-A/9',5).plan);
  await page.waitForTimeout(500);
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#battle-canvas canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    if (!gl) return { type: 'unavailable', vendor: null, renderer: null };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      type: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
      vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
      renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    };
  });
  const frames = await page.evaluate(dynamic => new Promise<number[]>(resolve => {
    const values: number[] = []; let previous: number | null = null; let start: number | null = null;
    const state = window.__game.state()!; const initialTick = state.tick;
    // RAF timestamps describe the frame boundary and may predate performance.now().
    // Anchor both values to the first RAF and exclude its unmeasured interval.
    function record(now: number) {
      if (previous !== null) values.push(now - previous);
      start ??= now;
      previous = now;
      if (dynamic) {
        const nextTick = initialTick + Math.floor((now - start) * 30 / 1000);
        if (nextTick !== state.tick) {
          // Synthetic presentation clock, not stepRun and not a legal combat replay.
          // Keep peak density while exercising the 30Hz world-cache rebuild path.
          state.tick = nextTick;
          state.enemies.forEach((enemy, i) => {
            enemy.x = 37 + i % 10 * 34 + Math.sin(nextTick / 30 + i) * 4;
            enemy.y = 38 + Math.floor(i / 10) * 32 + Math.cos(nextTick / 35 + i) * 4;
          });
          state.projectiles.forEach((projectile, i) => {
            projectile.x = 20 + i % 20 * 18;
            projectile.y = 25 + (i * 21 + nextTick * 3) % 420;
          });
          for (let i = 0; i < 3; i++) state.events.push({ seq: ++state.eventSeq, tick: nextTick, kind: i ? 'hit' : 'arc', source: i ? 'C01' : 'C02', x: 65 + i * 120, y: 100 + (nextTick * 2 + i * 70) % 250, x2: 280, y2: 210, value: 1 });
          state.events = state.events.slice(-100);
        }
      }
      if (now - start >= 60000) resolve(values); else requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  }), dynamic);
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * .95)];
  const host = { cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length, platform: platform(), release: release(), architecture: arch() };
  const artifact = { contentVersion: CONTENT_VERSION, sourceDigest, measuredAt: new Date().toISOString(), host, browser: info.project.name, browserVersion: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), fixture: { ...fixture, syntheticPresentationUpdatesHz: dynamic ? 30 : 0, transientEffectsPerUpdate: dynamic ? 3 : 0 }, renderer, tracingEnabled: false, durationMs: frames.reduce((n, t) => n + t, 0), samples: frames.length, p95FrameTimeMs: p95, maxFrameTimeMs: sorted.at(-1), gateReferenceMs: 33.3, desktopRenderPassed: p95 <= 33.3, limitation: `Synthetic paused game logic, active Phaser render${dynamic ? ' with synthetic 30Hz tick/position/event changes to rebuild cached world geometry' : ' using the paused world cache'}. Desktop headless Chromium only; not a real iPhone/Android GPU or live combat logic performance result. Playwright tracing disabled during measurement; screenshot taken afterward.`, frameTimesMs: frames };
  mkdirSync(`${output}/browser-results`, { recursive: true });
  mkdirSync(`${output}/screenshots`, { recursive: true });
  writeFileSync(`${output}/browser-results/desktop-render-performance${dynamic ? '-dynamic' : ''}.json`, JSON.stringify(artifact, null, 2));
  await page.screenshot({ path: `${output}/screenshots/desktop-render-stress${dynamic ? '-dynamic' : ''}.png` });
  expect(fixture).toEqual({ enemies: 120, visibleProjectiles: 400, fields: 12, bossId: 'B01', stageId: 'S01', pausedSimulation: true });
  expect(frames.length).toBeGreaterThan(1000);
  expect(p95).toBeLessThanOrEqual(33.3);
});
