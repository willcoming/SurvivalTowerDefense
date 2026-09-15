import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { CharacterId, FormId } from '../../src/sim/types';
import { ALLY_MOTION } from '../../src/data/character-motion';

const output = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/combat-spectacle/browser';
mkdirSync(output, { recursive: true });
const characters: CharacterId[] = ['C01','C02','C03','C04','C05','C06','C07','C08'];

for (const theme of ['original','summer'] as const) for (const captain of characters) test(`spectacle ${captain} ${theme}: real cast freezes battle, plays six Q poses and resumes`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async ({ captain, theme }) => {
    window.__game.getSave().preferences.autoTactical = false;
    await window.__game.start({ stageId: 'S03', squadIds: [captain], captainId: captain, seed: 91, forms: { [captain]: `${captain}-${theme}` as FormId } });
  }, { captain, theme });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  // Presentation fixture only: durable real enemies, real cast validation and real RAF.
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!; s.enemies = []; s.spawnCursor = s.spawnPlan.length;
    s.tacticalReadyAt = 0;
    for (const x of [90, 195, 300]) { const e = createEnemy(s, 'E03', x, 385); e.speed = 0; e.hp = e.maxHp = 1000000; }
  });
  const tutorial = page.locator('[data-action="tutorial-done"]');
  if (await tutorial.count()) await tutorial.first().click();
  if (captain === 'C07') await page.waitForFunction(() => (window.__game.state()!.mines?.length ?? 0) > 0);
  while (await page.locator('#speed-button').innerText() !== '3×') await page.locator('#speed-button').click();
  await page.locator('[data-action="cast"]').click();
  await page.waitForFunction(() => window.__game.presentation().cutin.visible);
  const start = await page.evaluate(() => {
    const s = window.__game.state()!;
    return { tick: s.tick, hp: s.wallHp, cooldown: s.tacticalReadyAt - s.tick, projectiles: JSON.stringify(s.projectiles), casts: s.stats.casts.length };
  });
  await page.waitForFunction(() => window.__game.presentation().cutin.age >= 680);
  const during = await page.evaluate(() => {
    const s = window.__game.state()!;
    return { tick: s.tick, hp: s.wallHp, cooldown: s.tacticalReadyAt - s.tick, projectiles: JSON.stringify(s.projectiles), casts: s.stats.casts.length, view: window.__game.presentation() };
  });
  expect(during.tick).toBe(start.tick); expect(during.hp).toBe(start.hp);
  expect(during.cooldown).toBe(start.cooldown); expect(during.projectiles).toBe(start.projectiles);
  expect(during.casts).toBe(start.casts);
  expect(during.view.textureFrames[captain]).toBe(ALLY_MOTION.frameCount);
  expect(during.view.cutin.texture).toBe(`motion-${captain}`);
  expect(during.view.cutin.fullScreen).toBe(true);
  expect(during.view.cutin.duration).toBe(1400);
  await page.screenshot({ path: `${output}/${info.project.name}-${captain}-${theme}-skill.png` });
  await page.waitForFunction(() => !window.__game.presentation().cutin.visible);
  expect(await page.evaluate(() => window.__game.presentation().cutin.frames)).toEqual(expect.arrayContaining([6,7,8,9,10,11]));
  await page.waitForFunction(tick => window.__game.state()!.tick > tick, start.tick);
  expect(errors).toEqual([]);
  writeFileSync(`${output}/${info.project.name}-${captain}-${theme}.json`, JSON.stringify({ evidence: 'Synthetic durable target fixture; actual app command, 3× RAF and render path.', start, during, errors }, null, 2));
});

test('spectacle pause/resume and canvas rebuild retain the unplayed portion', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async () => {
    window.__game.getSave().preferences.autoTactical = false;
    await window.__game.start({ stageId: 'S01', squadIds: ['C06'], captainId: 'C06', seed: 93 });
    window.__game.state()!.tacticalReadyAt = 0;
  });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  await page.locator('[data-action="cast"]').click();
  await page.waitForFunction(() => window.__game.presentation().cutin.age >= 230);
  await page.locator('[data-action="pause"]').click();
  const before = await page.evaluate(() => ({ age: window.__game.presentation().cutin.age, tick: window.__game.state()!.tick }));
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => ({ age: window.__game.presentation().cutin.age, tick: window.__game.state()!.tick }))).toEqual(before);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.waitForFunction(age => { try { return window.__game.presentation().cutin.age === age; } catch { return false; } }, before.age);
  // Touch emulation treats the landscape viewport as phone rotation.
  await expect(page.locator('[data-action="resume"]')).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => !window.__game.presentation().cutin.visible);
  await page.waitForFunction(tick => window.__game.state()!.tick > tick, before.tick);
  expect(await page.evaluate(() => window.__game.state()!.stats.casts.length)).toBe(1);
});

for (const speed of [1, 2]) test(`spectacle automatic cast at ${speed}× survives visibility pause without duplicate damage`, async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async () => {
    window.__game.getSave().preferences.autoTactical = false;
    await window.__game.start({ stageId: 'S01', squadIds: ['C06'], captainId: 'C06', seed: 94 });
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path); const s = window.__game.state()!;
    s.enemies = []; s.spawnCursor = s.spawnPlan.length; s.tacticalReadyAt = 0;
    const enemy = createEnemy(s, 'E03', 195, 200); enemy.speed = 0; enemy.hp = enemy.maxHp = 1e9;
  });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  while (await page.locator('#speed-button').innerText() !== `${speed}×`) await page.locator('#speed-button').click();
  await page.getByRole('button', { name: '自動施放隊長技能', exact: true }).click();
  await page.waitForFunction(() => window.__game.presentation().cutin.age >= 200 && window.__game.presentation().cutin.visible);
  const before = await page.evaluate(() => {
    // Exercise the application's real visibility handler with a deterministic visibility fixture.
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return { age: window.__game.presentation().cutin.age, tick: window.__game.state()!.tick, shield: window.__game.state()!.shields.reduce((n, s) => n + s.value, 0) };
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => ({ age: window.__game.presentation().cutin.age, tick: window.__game.state()!.tick, shield: window.__game.state()!.shields.reduce((n, s) => n + s.value, 0) }))).toEqual(before);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  const resumedAt = await page.evaluate(() => performance.now());
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => !window.__game.presentation().cutin.visible);
  const duration = await page.evaluate(() => performance.now()) - resumedAt;
  expect(duration).toBeGreaterThan(1400 - before.age - 80);
  expect(duration).toBeLessThan(1400 - before.age + 450);
  expect(await page.evaluate(() => window.__game.state()!.stats.casts.length)).toBe(1);
});
