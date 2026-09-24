import { describe, expect, it } from 'vitest';
import { STAGES, ENEMY_CODE, ticks } from '../../src/data/content';
import { STAGE_ENCOUNTERS } from '../../src/data/encounters';
import { legacyStageProfile, operationProfile, previousStageProfile as stageProfile } from '../../src/data/progression';
import { createRun as versionedRun, restoreRun, stepRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { spawnBossEscort, stepEnemies } from '../../src/sim/enemies';
import { difficultyTuning } from '../../src/sim/difficulty';
import { nextIntel } from '../../src/sim/operations';
const createRun=(...args:Parameters<typeof versionedRun>)=>versionedRun(args[0],args[1]??'0.5.0-dev.2',args[2]);

describe('authored encounters and historical battle compatibility', () => {
  it.each(STAGES)('$id preserves the point, XP, wave, enemy and time budgets in both difficulties', stage => {
    const old = legacyStageProfile(stage.id);
    expect(STAGE_ENCOUNTERS[stage.id].plan).toHaveLength(old.waves.length);
    for (const difficulty of ['easy', 'hard'] as const) {
      const profile = stageProfile(stage.id, difficulty);
      expect({ ...profile, waves: old.waves, waveNames: undefined, waveHints: undefined, groupIntervals: undefined })
        .toEqual({ ...old, waveNames: undefined, waveHints: undefined, groupIntervals: undefined });
      const run = createRun({ stageId: stage.id, difficulty, squadIds: ['C01'], captainId: 'C01', seed: 211 },undefined,{operationVersion:2});
      expect(run.spawnPlan).toHaveLength(old.enemies);
      expect(run.spawnPlan.reduce((n, e) => n + e.xp, 0)).toBe(old.points * 30);
      profile.waves.forEach((wave, index) => {
        const entries = run.spawnPlan.filter(e => e.wave === index + 1);
        const counts = Object.fromEntries(wave.split(' ').map(token => [ENEMY_CODE[token[0]], Number(token.slice(1))]));
        for (const [id, count] of Object.entries(counts)) expect(entries.filter(e => e.defId === id)).toHaveLength(count);
        expect(entries.every(e => stage.enemyIds.includes(e.defId))).toBe(true);
        expect(entries.reduce((n, e) => n + e.xp, 0)).toBe(old.waveXp[index]);
        expect(Math.max(...entries.map(e => e.at))).toBeLessThan(ticks((index + 1) * old.interval));
      });
      const intel = nextIntel(run);
      expect(intel[0].name).toBe(profile.waveNames![0]);
      expect(intel[0].hint).toBe(profile.waveHints![0]);
      expect(intel[0].counts.reduce((n, [, count]) => n + count, 0)).toBe(run.spawnPlan.filter(e => e.wave === 1).length - run.spawnCursor);
      const boss = createEnemy(run, stage.bossId, 195, 150);
      spawnBossEscort(run, boss);
      expect(run.enemies.every(e => e.defId === stage.bossId || stage.enemyIds.includes(e.defId))).toBe(true);
      expect(restoreRun(run)).toEqual(run);
    }
    expect(stageProfile(stage.id, 'hard').waves).not.toEqual(stageProfile(stage.id, 'easy').waves);
  });

  it('keeps old progression battles deterministic after a save and resume', () => {
    for (const legacyBalance of [true, false]) {
      const run = createRun({ stageId: 'S03', difficulty: 'hard', squadIds: ['C01'], captainId: 'C01', seed: 101 }, undefined, legacyBalance?{legacyBalance:true}:{balanceVersion:1,operationVersion:2});
      expect(run.balanceVersion).toBe(legacyBalance ? undefined : 1);
      expect(difficultyTuning(run).health).toBe(legacyBalance ? 1.5 : 1.4);
      expect(operationProfile(run)).toEqual(legacyBalance ? legacyStageProfile('S03') : stageProfile('S03', 'hard',{balanceVersion:1}));
      stepRun(run, 180);
      const resumed = restoreRun(run);
      stepRun(run, 120); stepRun(resumed, 120);
      expect(resumed).toEqual(run);
    }
  });

  it('rejects mismatched balance versions instead of silently rerolling a saved battle', () => {
    const run = createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 101 });
    expect(() => restoreRun({ ...run, balanceVersion: 3 })).toThrow();
    expect(() => restoreRun({ ...run, operationVersion: undefined })).toThrow();
    expect(() => restoreRun({ ...run, balanceVersion: undefined })).toThrow();
  });

  it.each(['S01', 'S02', 'S03'] as const)('%s retains full boss telegraphs despite increased pressure', stageId => {
    const stage = STAGES.find(s => s.id === stageId)!;
    const run = createRun({ stageId, squadIds: ['C01'], captainId: 'C01', seed: 101 });
    run.enemies = []; run.weapons = [];
    const boss = createEnemy(run, stage.bossId, 195, 150);
    run.tick = 149; stepEnemies(run); expect(boss.chargeKind).toBeNull();
    run.tick = 150; stepEnemies(run);
    expect(boss.chargeUntil - run.tick).toBe(stage.bossId === 'B03' ? 90 : 60);
    run.tick = boss.chargeUntil - 1; stepEnemies(run); expect(run.wallHp).toBe(1000);
  });
});
