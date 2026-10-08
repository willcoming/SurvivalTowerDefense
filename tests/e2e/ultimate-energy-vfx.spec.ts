import { test, expect } from '@playwright/test';
import { ready, startBattle } from '../helpers/mobile-ui';

test('ultimate energy accumulation during CD, primed ready state, and battlefield cast VFX', async ({ page }, info) => {
  await ready(page);
  await startBattle(page);

  // 1. Give C01 and C02 ultimate skills in simulation
  await page.evaluate(async () => {
    const treesPath = '/src/data/deep-trees.ts';
    const ultPath = '/src/sim/ultimates.ts';
    const { deepTreesFor } = await import(treesPath);
    const { ultimateNodeId } = await import(ultPath);
    const s = window.__game.state()!;

    for (const charId of ['C01', 'C02'] as const) {
      const tree = deepTreesFor(charId, s).find((t: any) => t.nodes.some((n: any) => n.id === ultimateNodeId(charId, s)))!;
      s.treeNodes!.push(...tree.nodes.slice(0, 5).map((n: any) => n.id));
    }

    // Set C01 to 60% cooldown progress
    const w1 = s.weapons.find(w => w.id === 'C01')!;
    w1.ultimateReadyAt = s.tick + 12 * 30; // 12 seconds remaining out of ~30s

    // Set C02 to 100% ready (0 cooldown remaining)
    const w2 = s.weapons.find(w => w.id === 'C02')!;
    w2.ultimateReadyAt = 0;
  });

  // Let scene update frames
  await page.waitForTimeout(300);

  // Check diagnostics for energy accumulation and ready status
  const diag = await page.evaluate(() => (window.__game.presentation() as any).ultimateEnergy);
  expect(diag.chargedCount).toBeGreaterThanOrEqual(1);
  expect(diag.readyCount).toBeGreaterThanOrEqual(1);

  // Screenshot 1: C01 accumulating energy on CD, C02 with primed golden pulse
  await page.screenshot({ path: info.outputPath('ultimate-energy-cd-and-ready.png') });

  // 2. Trigger an ultimate cast from C01 and C02 onto enemies
  await page.evaluate(async () => {
    const combatPath = '/src/sim/combat.ts';
    const ultPath = '/src/sim/ultimates.ts';
    const { createEnemy } = await import(combatPath);
    const { stepUltimates } = await import(ultPath);
    const s = window.__game.state()!;

    s.enemies = [];
    const target = createEnemy(s, 'E03', 195, 240, 0, s.waveFlow!.wave);
    target.hp = target.maxHp = 50000;

    // Ready C01 to cast immediately
    s.weapons.find(w => w.id === 'C01')!.ultimateReadyAt = 0;

    // Step ultimates to trigger casting
    stepUltimates(s);
  });

  // Wait a frame for cast bursts and battlefield animations
  await page.waitForTimeout(100);

  // Screenshot 2: Ultimate cast burst on ally and battlefield impact
  await page.screenshot({ path: info.outputPath('ultimate-cast-burst-battlefield.png') });
});
