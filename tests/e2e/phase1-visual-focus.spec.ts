import { test, expect, type Page } from '@playwright/test';
import { ready, startBattle } from '../helpers/mobile-ui';

async function setup(page: Page) {
  await ready(page); await startBattle(page);
  const ids = await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const run = window.__game.state()!;
    run.enemies = []; run.projectiles = []; run.fields = []; run.scheduled = [];
    run.spawnCursor = run.spawnPlan.length;
    run.weapons.forEach(w => { w.nextAttack = 999999; w.ultimateReadyAt = 999999; });
    return [110, 280].map(x => {
      const enemy = createEnemy(run, 'E03', x, 270, 0, run.waveFlow!.wave);
      enemy.hp = enemy.maxHp = 100000; enemy.speed = 0; enemy.abilityAt = 999999;
      return enemy.id;
    });
  });
  await page.waitForFunction(ids => ids.every(id => window.__game.presentation().enemyMotions.some(e => e.id === id)), ids);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return ids;
}

async function tapEnemy(page: Page, x: number, y: number) {
  const box = (await page.locator('#battle-canvas canvas').boundingBox())!;
  const px = box.x + box.width * x / 390, py = box.y + box.height * y / 520;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) test.describe(`viewport ${width}`, () => {
  test.use({ hasTouch: width < 768, isMobile: width < 768 });
  test(`phase1 focus interaction and layout at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const ids = await setup(page);
  await tapEnemy(page, 280, 270);
  await expect.poll(() => page.evaluate(() => window.__game.presentation().focus?.id)).toBe(ids[1]);
  expect(await page.evaluate(() => window.__game.presentation().threatLine.active)).toBe(true);
  await page.screenshot({ path: info.outputPath(`focus-${width}.png`) });
  await tapEnemy(page, 280, 270);
  await expect.poll(() => page.evaluate(() => window.__game.state()!.focusTargetId)).toBeNull();
  await page.locator('#battle-canvas canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__game.presentation().focus?.id)).toBe(ids[0]);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__game.state()!.focusTargetId)).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  });
});

test('phase1 real attacks follow focus; death releases it and threat line returns to idle', async ({ page }) => {
  const ids = await setup(page);
  await tapEnemy(page, 280, 270);
  await page.evaluate(() => { const s = window.__game.state()!; s.events = []; s.weapons.find(w => w.id === 'C02')!.nextAttack = s.tick; });
  await page.waitForFunction(() => window.__game.state()!.events.some(e => e.kind === 'beam' && e.source === 'C02'));
  expect(await page.evaluate(() => window.__game.state()!.events.find(e => e.kind === 'beam' && e.source === 'C02'))).toMatchObject({ x2: 280, y2: 270 });
  await page.evaluate(async id => {
    const path = '/src/sim/combat.ts'; const { hitEnemy } = await import(path);
    const s = window.__game.state()!; s.weapons.forEach(w => w.nextAttack = 999999);
    hitEnemy(s, s.enemies.find(e => e.id === id)!, { source: 'C01', skill: 'weapon', raw: 1e9, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
    s.enemies.filter(e => e.hp > 0).forEach(e => e.y = 100);
  }, ids[1]);
  await expect.poll(() => page.evaluate(() => window.__game.presentation().focus)).toBeNull();
  await expect.poll(() => page.evaluate(() => window.__game.presentation().threatLine)).toEqual({ y: 230, active: false, alpha: .25 });
  await expect.poll(() => page.evaluate(() => window.__game.presentation().focusFading)).toBe(false);
});

test('phase1 body burn, merged numbers and critical bounce render from real damage', async ({ page }, info) => {
  await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { applyEffect, hitEnemy } = await import(path);
    const s = window.__game.state()!, e = s.enemies[0];
    applyEffect(s, e, { id: 'phase1-burn', kind: 'burn', source: 'C05', value: 8, expires: s.tick + 300, nextTick: s.tick + 999, armorIgnore: .5 });
    for (const raw of [3, 5]) hitEnemy(s, e, { source: 'C05', skill: 'burn', raw, damageType: 'thermal', armorIgnore: 1, shieldMultiplier: 1 });
  });
  await page.waitForFunction(() => window.__game.presentation().damageNumbers.some(n => n.kind === 'dot'));
  const dot = await page.evaluate(() => window.__game.presentation().damageNumbers.find(n => n.kind === 'dot')!);
  expect(dot.value).toBe(8); expect(dot.text).toBe('8'); expect(dot.fontSize).toBe('12px');
  expect(await page.evaluate(() => window.__game.presentation().statuses[0].states)).toContain('burn');
  await page.screenshot({ path: info.outputPath('body-burn.png') });
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { hitEnemy } = await import(path);
    const s = window.__game.state()!, e = s.enemies[1]; e.shield = 1;
    hitEnemy(s, e, { source: 'C01', skill: 'weapon', raw: 40, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
  });
  await page.waitForFunction(() => window.__game.presentation().damageNumbers.some(n => n.kind === 'critical' && n.scale > 1.05));
  expect(await page.evaluate(() => window.__game.presentation().damageNumbers.find(n => n.kind === 'critical')!.fontSize)).toBe('22px');
  expect(await page.evaluate(() => window.__game.presentation().impactCount)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('critical.png') });
  await expect.poll(() => page.evaluate(() => window.__game.presentation().damageNumbers.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('phase1 reduced motion disables camera shake and critical scaling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { hitEnemy } = await import(path);
    const s = window.__game.state()!, e = s.enemies[0]; e.shield = 1;
    hitEnemy(s, e, { source: 'C01', skill: 'weapon', raw: 40, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
  });
  await page.waitForFunction(() => window.__game.presentation().damageNumbers.some(n => n.kind === 'critical'));
  const result = await page.evaluate(() => window.__game.presentation());
  expect(result.impactCount).toBe(0);
  expect(result.damageNumbers.find(n => n.kind === 'critical')!.scale).toBe(1);
  expect(result.threatLine.alpha).toBe(.85);
});
