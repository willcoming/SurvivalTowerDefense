import { expect, test } from '@playwright/test';

test('first stage immediately uses v4 pressure and the hundred-wave preview matches its schedule', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.route('hundred'));
  await expect(page.locator('.hundred-summary')).toContainText('每約 15 秒');
  await page.evaluate(async () => {
    const save = window.__game.getSave(); save.preferences.tutorialSeen = true; save.preferences.battleSpeed = 3;
    await window.__game.start({ stageId: 'S01', difficulty: 'easy', squadIds: ['C04','C01','C03','C05','C06'], captainId: 'C04', seed: 101 });
  });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(async () => {
    const state = window.__game.state()!;
    const profilePath = '/src/data/progression.ts', statsPath = '/src/sim/operations.ts', enginePath = '/src/sim/engine.ts';
    const { operationProfile } = await import(profilePath), { waveStats } = await import(statsPath), { createRun } = await import(enginePath);
    const previous = createRun(state.config, '0.6.0-dev.1');
    return { version: state.balanceVersion, interval: operationProfile(state).interval,
      healthRatio: waveStats(state, 'E01', 1).hp / waveStats(previous, 'E01', 1).hp,
      explicitFirstWave: !!operationProfile(state).formations?.[0], tick: state.tick };
  });
  expect(before).toMatchObject({ version: 4, interval: 18.75, healthRatio: 1.25, explicitFirstWave: true });
  // Let the real renderer and spawn loop run, without replacing enemy HP or giving skill points.
  await page.waitForFunction(tick => window.__game.state()!.tick >= tick + 300, before.tick, { timeout: 15000 });
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
  await page.screenshot({ path: info.outputPath('first-stage-pressure.png') });
  expect(errors).toEqual([]);
});
