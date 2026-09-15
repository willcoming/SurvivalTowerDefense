import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { difficultyPlan, naturalCommander } from '../../scripts/lib/difficulty-policy';

test.use({ trace: 'off' });

for (const scenario of [{ stage: 'S12', manual: false }, { stage: 'S11', manual: true }] as const) {
test(`${scenario.stage} hard ${scenario.manual ? 'manual' : 'auto'}: earned build completes through live 3× rendering`, async ({ page }, info) => {
  test.setTimeout(90000);
  await page.routeWebSocket('**/*', socket => socket.close());
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  const policy = difficultyPlan('chain', scenario.stage), commander = naturalCommander(scenario.stage, 'hard');
  await page.evaluate(async ({ policy, commander, stage }) => {
    const save = window.__game.getSave();
    // Prior-clear fixture supplies exactly the same naturally earned XP as the balance sweep.
    save.profile.cleared = ['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12'];
    save.profile.easyCleared = [...save.profile.cleared];
    save.profile.commander = { version: 1, xp: commander.xp, skillIds: commander.nodes, firstClears: [...save.profile.cleared], creditedRunIds: [] };
    save.preferences.autoTactical = false; save.preferences.tutorialSeen = true; save.preferences.battleSpeed = 3;
    const loading = window.__game.start({ stageId: stage, difficulty: 'hard', squadIds: policy.squad, captainId: policy.captain, seed: 211 });
    window.__game.command({ type: 'pause', reason: 'user' }); await loading;
  }, { policy, commander, stage: scenario.stage });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  const prepared = await page.evaluate(async ({plan, manual}) => {
    const enginePath = '/src/sim/engine.ts', treePath = '/src/sim/deep-tree.ts', autoPath = '/src/ui/auto-tactical.ts';
    const { command, stepRun } = await import(enginePath), { deepLegalNodes, deepNodeCost } = await import(treePath), { shouldAutoCast } = await import(autoPath);
    const policyPath = '/scripts/lib/difficulty-policy.ts', { shouldManualCast } = await import(policyPath);
    const api = window.__game, s = api.state()!;
    command(s, { type: 'resume', reason: 'user' });
    for (let guard = 0; guard < 20000 && !s.bossIntro && !s.outcome; guard++) {
      if (s.draft) {
        const legal = deepLegalNodes(s), nodeId = plan.find(id => !s.treeNodes!.includes(id) && legal.includes(id) && deepNodeCost(id, s) <= s.draft!.pointTarget! - s.choicesSpent);
        if (!nodeId || !command(s, { type: 'buy-node', offerId: s.draft.id, nodeId })) throw new Error('Invalid earned build');
      } else { if (shouldAutoCast(s, true) && (!manual || shouldManualCast(s))) command(s, { type: 'cast' }); stepRun(s); }
    }
    command(s, { type: 'pause', reason: 'user' }); api.ticks(0);
    return { tick: s.tick, hp: s.wallHp, points: s.choicesSpent, bossIntro: !!s.bossIntro, enemies: s.enemies.length, nodes: s.treeNodes };
  }, {plan: policy.plan, manual: scenario.manual});
  expect(prepared.bossIntro).toBe(true); expect(prepared.points).toBe(24); expect(prepared.enemies).toBeGreaterThanOrEqual(33);
  await page.screenshot({ path: info.outputPath('boss-entry.png') });
  await page.evaluate(async manual => {
    window.__game.getSave().preferences.autoTactical = !manual;
    if (manual) {
      const policyPath = '/scripts/lib/difficulty-policy.ts', autoPath = '/src/ui/auto-tactical.ts';
      const { shouldManualCast } = await import(policyPath), { shouldAutoCast } = await import(autoPath);
      function cast() {
        const s = window.__game.state()!;
        if (s.outcome) return;
        if (shouldAutoCast(s, true) && shouldManualCast(s)) window.__game.command({ type: 'cast' });
        requestAnimationFrame(cast);
      }
      requestAnimationFrame(cast);
    }
    window.__game.command({ type: 'resume', reason: 'user' });
  }, scenario.manual);
  await page.waitForFunction(() => !window.__game.state()!.bossIntro);
  await page.screenshot({ path: info.outputPath('boss-live.png') });
  const measured = await page.evaluate(() => new Promise<{ frames: number[]; peakEnemies: number; cutinFrames: number; outcome: string | null; hp: number; tick: number }>(resolve => {
    let previous = 0, peakEnemies = 0, cutinFrames = 0;
    const frames: number[] = [];
    function record(now: number) {
      const s = window.__game.state()!;
      if (previous) frames.push(now - previous); previous = now;
      peakEnemies = Math.max(peakEnemies, s.enemies.length);
      if (!s.outcome && window.__game.presentation()?.cutin.visible) cutinFrames++;
      if (s.outcome) resolve({ frames, peakEnemies, cutinFrames, outcome: s.outcome, hp: s.wallHp, tick: s.tick });
      else requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  }));
  expect(measured.outcome).toBe('victory'); expect(measured.cutinFrames).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await expect(page.locator('.result-screen')).toBeVisible();
  await page.screenshot({ path: info.outputPath('victory.png') });
  const sorted = [...measured.frames].sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * .95)];
  writeFileSync(info.outputPath('live-difficulty.json'), JSON.stringify({ scenario, method: 'Legal earned-point simulation to boss entry, then actual RAF at 3×. Prior-clear progression fixture; no battle HP, enemy or XP overrides. Desktop browser, not physical phone.', prepared, ...measured, p95FrameMs: p95, errors }, null, 2));
  expect(p95).toBeLessThanOrEqual(33.3);
});
}
