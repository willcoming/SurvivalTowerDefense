import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/combat-spectacle/ammunition';
mkdirSync(output, { recursive: true });
for (const source of ['C01', 'C02', 'C03', 'C05', 'C06', 'C08'] as const) test(`ammunition ${source}: actual attacks use finite painted objects`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(source => {
    window.__game.getSave().preferences.autoTactical = false;
    return window.__game.start({ stageId: 'S03', squadIds: [source], captainId: source, seed: 141 });
  }, source);
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!; s.spawnCursor = s.spawnPlan.length; s.enemies = []; s.projectiles = [];
    const enemy = createEnemy(s, 'E03', 230, 330); enemy.speed = 0; enemy.hp = enemy.maxHp = 1e8;
    if (s.weapons[0].id === 'C06') {
      const draftPath = '/src/sim/draft.ts', enginePath = '/src/sim/engine.ts';
      const { openDraft } = await import(draftPath), { command } = await import(enginePath);
      s.xp = 60; s.choicesEarned = 2; openDraft(s);
      for (const nodeId of ['C06-A/0', 'C06-A/3']) if (!command(s, { type: 'buy-node', offerId: s.draft!.id, nodeId })) throw new Error(`Rejected missile fixture ${nodeId}`);
      s.weapons[0].attacks = 3;
    }
    s.weapons[0].readyAt = s.tick + 3; s.weapons[0].nextAttack = s.tick + 3;
  });
  const result = await page.evaluate(() => new Promise<{ frames: number[]; observedPositions: {id: number; x: number; y: number}[]; damage: number; widths: number[] }>((resolve, reject) => {
    const frames = new Set<number>(), positions: {id: number; x: number; y: number}[] = [], widths: number[] = [];
    const started = performance.now();
    function record() {
      const s = window.__game.state()!, view = window.__game.presentation();
      for (const p of view.projectileVisuals.sprites) { frames.add(p.frame); positions.push({ id: p.id, x: p.x, y: p.y }); widths.push(p.width); }
      for (const cue of view.materialEffects.ammunition) if (cue.frame < 12) { frames.add(cue.frame); widths.push(cue.width); }
      const damage = s.enemies.reduce((n, e) => n + e.maxHp - e.hp, 0);
      if (performance.now() - started > 2200 && frames.size && damage > 0) resolve({ frames: [...frames], observedPositions: positions, damage, widths });
      else if (performance.now() - started > 5000) reject(new Error('No illustrated attack or actual damage'));
      else requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  }));
  const expected = { C01: [0], C02: [8, 9, 10, 11], C03: [2], C05: [4], C06: [5], C08: [6] }[source];
  expect(result.frames.some(frame => expected.includes(frame))).toBe(true);
  expect(Math.max(...result.widths)).toBeLessThanOrEqual(50);
  expect(result.damage).toBeGreaterThan(0);
  if (['C01', 'C05', 'C06', 'C08'].includes(source)) {
    const ids = new Set(result.observedPositions.map(p => p.id));
    expect([...ids].some(id => new Set(result.observedPositions.filter(p => p.id === id).map(p => `${p.x}:${p.y}`)).size > 1)).toBe(true);
  }
  // Pause at an actual newly visible attack to inspect the rendered material.
  await page.waitForFunction(() => {
    const v = window.__game.presentation();
    if (v.projectileVisuals.sprites.some(s => s.y < 425 && s.y > 350) || v.materialEffects.ammunition.some(s => s.frame < 12 && s.y < 425 && s.y > 350)) { window.__game.command({ type: 'pause', reason: 'user' }); return true; }
    return false;
  });
  // Hide only the pause dialog during the evidence capture; simulation remains paused.
  await page.screenshot({ style: '#battle-overlay { display: none !important; }', path: `${output}/${info.project.name}-${source}-ammo.png` });
  writeFileSync(`${output}/${info.project.name}-${source}-ammo.json`, JSON.stringify(result, null, 2));
  expect(errors).toEqual([]);
});

test('ammunition hostile: real enemy shot stays visible in compact mode and pauses in place', async ({ page }, info) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => {
    window.__game.getSave().preferences.autoTactical = false;
    window.__game.getSave().preferences.reducedEffects = true;
    return window.__game.start({ stageId: 'S03', squadIds: ['C01'], captainId: 'C01', seed: 142 });
  });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!; s.spawnCursor = s.spawnPlan.length; s.enemies = []; s.projectiles = [];
    const e = createEnemy(s, 'E05', 220, 250); e.hp = e.maxHp = 1e8; e.speed = 0; e.abilityAt = s.tick;
    s.weapons[0].readyAt = s.weapons[0].nextAttack = 999999;
  });
  await page.waitForFunction(() => {
    const v = window.__game.presentation();
    if (v.projectileVisuals.sprites.some(p => p.frame === 7 && p.y > 285)) { window.__game.command({ type: 'pause', reason: 'user' }); return true; }
    return false;
  });
  const before = await page.evaluate(() => ({ view: window.__game.presentation().projectileVisuals, projectiles: window.__game.state()!.projectiles.map(p => ({ id: p.id, x: p.x, y: p.y })) }));
  expect(before.view.sprites.map(p => p.id).sort()).toEqual(before.projectiles.map(p => p.id).sort());
  expect(before.view.sprites.every(p => p.frame === 7 && before.projectiles.some(actual => actual.id === p.id && actual.x === p.x && actual.y === p.y))).toBe(true);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__game.presentation().projectileVisuals)).toEqual(before.view);
  // Hide only the pause dialog during the evidence capture; simulation remains paused.
  await page.screenshot({ style: '#battle-overlay { display: none !important; }', path: `${output}/${info.project.name}-hostile-ammo.png` });
});
