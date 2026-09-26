import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/balance-v3.json';
import { createRun as versionedRun, restoreRun, stepRun } from '../../src/sim/engine';
import { STAGES } from '../../src/data/content';
import { operationProfile, stageProfile } from '../../src/data/progression';
import { waveStats, waveAttackDamage } from '../../src/sim/operations';
import { pressure } from '../../src/sim/difficulty';
import { spawnBossEscort } from '../../src/sim/enemies';
import { createEnemy } from '../../src/sim/combat';
import { TIMED_TACTICAL_VERSION } from '../../src/data/tactical-skills';
const createRun=(...args:Parameters<typeof versionedRun>)=>versionedRun(args[0],args[1]??TIMED_TACTICAL_VERSION,args[2]);
import type { RunConfig } from '../../src/sim/types';

describe('assault balance v4', () => {
  it('preserves all 66 v3 histories byte-for-byte and still restores their original rules', () => {
    for (const fixture of fixtures) {
      const s = createRun(fixture.config as RunConfig, '0.6.0-dev.1');
      expect(s.balanceVersion).toBe(3); s.runId = 'balance-v3-fixture'; stepRun(s, 120);
      expect(createHash('sha256').update(JSON.stringify(s)).digest('hex')).toBe(fixture.sha256);
      const restored = restoreRun(s); stepRun(s, 60); stepRun(restored, 60); expect(restored).toEqual(s);
    }
  });
  for (const stage of STAGES) for (const mode of ['easy','hard','four','no-skill','two-evolutions'] as const) {
    if (stage.id.startsWith('X') && !['easy','hard'].includes(mode)) continue;
    it(`${stage.id}/${mode}: 3x authored wave pressure from wave one with unchanged rewards`, () => {
      const config: RunConfig = { stageId: stage.id, difficulty: mode === 'easy' ? 'easy' : 'hard',
        challengeId: mode === 'easy' || mode === 'hard' ? null : mode,
        squadIds: ['C01','C02','C03','C06'], captainId: 'C01', seed: 101 };
      const s = createRun(config), old = createRun(config, '0.6.0-dev.1');
      const p = operationProfile(s), previous = operationProfile(old);
      expect(s.contentVersion).toBe(TIMED_TACTICAL_VERSION); expect(s.balanceVersion).toBe(4);
      expect(pressure(s).bossDamage/pressure(old).bossDamage).toBe(stage.id==='S01'?2:1);
      expect(pressure(s).bossInterval).toBe(pressure(old).bossInterval);
      for (const key of ['points','enemies','waveXp','escortCount','escortXp'] as const) expect(p[key]).toEqual(previous[key]);
      expect(p.waves).toHaveLength(previous.waves.length); expect(p.formations?.every(Boolean)).toBe(true);
      if (stage.id === 'S01') {
        expect(p.waveKinds![0]).toBe('mixed');
        expect(s.spawnPlan.filter(entry => entry.wave === 1).some(entry => entry.defId === 'E05')).toBe(true);
      }
      expect(p.interval).toBe(previous.interval * .75);
      const first = waveStats(s, 'E01', 1), before = waveStats(old, 'E01', 1);
      expect(first.hp / before.hp * waveAttackDamage(s,1,1) * previous.interval / p.interval).toBeCloseTo(3);
      expect(first.speed).toBe(before.speed);
      // Compare equal authored variants to isolate the only durability multiplier.
      old.wavePlan = structuredClone(s.wavePlan);
      for (const id of stage.enemyIds) {
        const now = waveStats(s, id, 3), prior = waveStats(old, id, 3);
        expect(now.hp / prior.hp).toBeCloseTo(id.startsWith('B') ? 1 : 1.25);
        if (prior.shield) expect(now.shield / prior.shield).toBeCloseTo(id.startsWith('B') ? 1 : 1.25);
      }
      expect(s.spawnPlan.length).toBe(p.enemies + p.escortCount!);
      expect(s.spawnPlan.reduce((n, entry) => n + entry.xp, 0)).toBe(p.points * 30);
      expect(p).toEqual(stageProfile(stage.id, config.difficulty, { balanceVersion: 4, challengeId: config.challengeId }));
      expect(waveAttackDamage(s,1,10)).toBe(18);
      expect(waveAttackDamage(s,p.waves.length+1,10)).toBe(10);
      expect(waveStats(s,'E01',p.waves.length+1)).toEqual(waveStats(old,'E01',p.waves.length+1));
      const count = s.enemies.length; spawnBossEscort(s, createEnemy(s, stage.bossId, 195, 150));
      expect(s.enemies.length).toBe(count + 1); // Scheduled escorts cannot also spawn immediately.
      expect(restoreRun(s)).toEqual(s);
    });
  }
  it('raises hundred-wave pressure from its first wave while preserving ten-wave recovery and 60 points', () => {
    const config: RunConfig = { stageId: 'S03', mode: 'hundred', difficulty: 'easy', squadIds: ['C01'], captainId: 'C01', seed: 101 };
    const s = createRun(config), old = createRun(config, '0.6.0-dev.1');
    const p = operationProfile(s), previous = operationProfile(old);
    expect(p.interval).toBe(15); expect(p.waves).toHaveLength(100); expect(p.points).toBe(60);
    expect(p.waveXp).toEqual(previous.waveXp); expect(p.enemies).toBe(previous.enemies);
    for (const wave of [1,20,60,100]) expect(waveStats(s, 'E01', wave).hp / waveStats(old, 'E01', wave).hp * 1.8 / .75).toBeCloseTo(3);
    for (let i = 0; i < 100; i += 10) expect(p.waveKinds![i+8]).toBe('respite');
    expect(restoreRun(old)).toEqual(old); expect(restoreRun(s)).toEqual(s);
  });
});
