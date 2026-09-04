import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, platform, release, arch } from 'node:os';
import { resolve } from 'node:path';

const dir = 'artifacts/validation/animation-update';
function sourceFiles(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourceFiles(resolve(dir, e.name)) : [resolve(dir, e.name)]).sort(); }
test.use({ trace: 'off' });
test('ANIM PERF: 60 seconds of live 3× simulation and animation under synthetic peak density', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Measured desktop environment; not physical mobile hardware.');
  test.setTimeout(90000);
  await page.routeWebSocket('**/*', socket => socket.close());
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.start({ stageId: 'S01', squadIds: ['C01','C02','C03','C05','C06'], captainId: 'C05', seed: 101 }));
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  while (await page.locator('#speed-button').innerText() !== '3×') await page.locator('#speed-button').click();
  const fixture = await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!;
    // Immortal stationary targets and inert hostile bolts maintain peak density.
    // Actual stepRun, weapons, skills, hit effects, fields, UI and local autosave remain active.
    s.enemies = []; s.projectiles = []; s.fields = []; s.scheduled = [];
    s.spawnCursor = s.spawnPlan.length; s.bossSpawned = true; s.bossKilled = false;
    s.xp = 0; s.choicesEarned = 0;
    for (let i = 0; i < 120; i++) {
      const e = createEnemy(s, i === 119 ? 'B01' : i % 2 ? 'E02' : 'E01', 37 + i % 10 * 34, 38 + Math.floor(i / 10) * 32, 0, 9);
      e.hp = e.maxHp = 1e12; e.speed = 0; e.abilityAt = e.summonAt = 999999;
    }
    s.enemies.at(-1)!.chargeKind = 'boss'; s.enemies.at(-1)!.chargeUntil = 999999;
    for (let i = 0; i < 400; i++) s.projectiles.push({ id: s.nextEntityId++, x: 20 + i % 20 * 18, y: 30 + Math.floor(i / 20) * 20, tx: 195, ty: 450, vx: 0, vy: 0, expires: 999999, hitIds: [], remaining: 1, falloff: [1], radius: 4, blastRadius: 0, packet: null, enemyDamage: 1, enemySource: 'E05', impactAt: 0 });
    for (let i = 0; i < 12; i++) s.fields.push({ id: s.nextEntityId++, source: i % 2 ? 'C04' : 'C05', kind: i % 2 ? 'gravity' : 'fire', x: 65 + i % 3 * 120, y: 80 + Math.floor(i / 3) * 95, radius: 45, expires: 999999, nextTick: s.tick, dps: 1, damageType: 'thermal', slow: .1, slowDuration: 30, pull: 0, burnDuration: 30, armorIgnore: 0 });
    for (const w of s.weapons.slice(0, 3)) { w.rank = 3; w.branch = 'A'; }
    s.evolvedCount = 3;
    return { enemies: 120, persistentHostileProjectiles: 400, fields: 12, evolutions: 3, bossId: 'B01', speed: 3, liveSimulation: true };
  });
  await page.waitForTimeout(500);
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'unavailable'; const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  });
  const measured = await page.evaluate(() => new Promise<{ frames: number[]; startTick: number; endTick: number; phases: string[]; minEnemies: number; minProjectiles: number; minFields: number; cutinFrames: number; warningMissingFrames: number; finalView: ReturnType<Window['__game']['presentation']> }>(resolve => {
    const frames: number[] = [], phases = new Set<string>(); let start = 0, previous = 0, startTick = 0;
    let minEnemies = Infinity, minProjectiles = Infinity, minFields = Infinity, cutinFrames = 0, warningMissingFrames = 0;
    function record(now: number) {
      const s = window.__game.state()!, view = window.__game.presentation();
      if (previous) frames.push(now - previous); else { start = now; startTick = s.tick; }
      previous = now; phases.add(s.phase);
      minEnemies = Math.min(minEnemies, s.enemies.length); minProjectiles = Math.min(minProjectiles, s.projectiles.length); minFields = Math.min(minFields, s.fields.length);
      if (view.cutin.visible) cutinFrames++; if (!view.warnings.visible) warningMissingFrames++;
      if (s.tacticalReadyAt <= s.tick) window.__game.command({ type: 'cast' });
      if (now - start >= 60000) resolve({ frames, startTick, endTick: s.tick, phases: [...phases], minEnemies, minProjectiles, minFields, cutinFrames, warningMissingFrames, finalView: view });
      else requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  }));
  const sorted = [...measured.frames].sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * .95)];
  const elapsed = measured.frames.reduce((a, b) => a + b, 0), ticksPerSecond = (measured.endTick - measured.startTick) * 1000 / elapsed;
  const passed = p95 <= 33.3 && ticksPerSecond >= 85 && measured.phases.join() === 'running' && measured.minEnemies === 120 && measured.minProjectiles >= 400 && measured.minFields === 12 && measured.cutinFrames > 0 && measured.warningMissingFrames === 0 && errors.length === 0;
  mkdirSync(`${dir}/screenshots`, { recursive: true });
  writeFileSync(`${dir}/live-3x-performance.json`, JSON.stringify({ measuredAt: new Date().toISOString(), sourceDigest: createHash('sha256').update(JSON.stringify(sourceFiles(resolve('src')).map(p => [p.replace(`${process.cwd()}/`, ''), readFileSync(p, 'utf8')]))).digest('hex'), host: { cpu: cpus()[0]?.model, platform: platform(), release: release(), architecture: arch() }, browser: info.project.name, userAgent: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), renderer, fixture, durationMs: elapsed, p95FrameTimeMs: p95, maxFrameTimeMs: sorted.at(-1), ticksPerSecond, gateMs: 33.3, passed, errors, limitation: 'Synthetic peak-density fixture, not a legally earned build or balance test. Stationary immortal targets and inert hostile projectiles sustain density; the real 3× simulation, automatic attacks, timed captain skills, animation, rendering and autosave run throughout. Desktop Chromium/SwiftShader only, not phone hardware. Tracing disabled and screenshot taken after measurement.', ...measured }, null, 2));
  await page.screenshot({ path: `${dir}/screenshots/live-3x-pressure.png` });
  expect(passed).toBe(true);
});
