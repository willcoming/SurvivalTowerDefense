import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/balance-v5.json';
import { createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { operationProfile } from '../../src/data/progression';
import { ADVANCED_TUNING } from '../../src/data/assault-balance';
import { STAGES } from '../../src/data/content';
import { pressure } from '../../src/sim/difficulty';
import { waveStats, waveAttackDamage } from '../../src/sim/operations';
import type { RunConfig } from '../../src/sim/types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const config: RunConfig = {stageId:'S03',difficulty:'hard',squadIds:['C01','C02','C03','C06'],captainId:'C01',seed:101};
const bodies = (wave: string) => Object.fromEntries(wave.split(' ').map(token => [token[0], Number(token.slice(1))]));

describe('advanced balance v6', () => {
  it('preserves all 66 v5 profiles and battle snapshots, including their XP distribution', () => {
    for (const fixture of fixtures) {
      const state = createRun(fixture.config as RunConfig, undefined, {balanceVersion:5,experienceVersion:3});
      state.runId = 'balance-v5-fixture';
      expect(hash(operationProfile(state))).toBe(fixture.profileHash);
      stepRun(state,120);
      expect(hash(state)).toBe(fixture.stateHash);
      const restored = restoreRun(state); stepRun(state,60); stepRun(restored,60);
      expect(restored).toEqual(state);
    }
  });

  it('keeps the version-6 balance and XP pairing', () => {
    const state=createRun(config,undefined,{balanceVersion:6});
    expect(state.balanceVersion).toBe(6); expect(state.experienceVersion).toBe(4);
    expect(restoreRun(state)).toEqual(state);
    const old=createRun(config,undefined,{balanceVersion:5});
    expect(old.experienceVersion).toBe(3);
  });

  it('leaves every Easy enemy roster, timing, reward budget and combat multiplier unchanged', () => {
    for (const stage of STAGES) {
      const cfg={...config,stageId:stage.id,difficulty:'easy' as const};
      // Pin the historical XP curve to isolate the enemy-balance changes.
      const old=createRun(cfg,undefined,{balanceVersion:5,experienceVersion:3});
      const current=createRun(cfg,undefined,{balanceVersion:6,experienceVersion:3});
      expect(operationProfile(current)).toEqual(operationProfile(old));
      expect(current.spawnPlan).toEqual(old.spawnPlan);
      expect(pressure(current)).toEqual(pressure(old));
      for (const id of stage.enemyIds) for (const wave of [1,3,10]) expect(waveStats(current,id,wave)).toEqual(waveStats(old,id,wave));
      expect(waveAttackDamage(current,3,100)).toBe(waveAttackDamage(old,3,100));
    }
  });

  for (const mode of ['hard','four','no-skill','two-evolutions'] as const) it(`${mode}: lowers enemy health/damage 12% without changing player skills or rewards`, () => {
    for (const stage of STAGES.filter(stage=>!stage.id.startsWith('X')||mode==='hard')) {
      const cfg={...config,stageId:stage.id,challengeId:mode==='hard'?null:mode};
      const old=createRun(cfg,undefined,{balanceVersion:5,experienceVersion:3});
      const current=createRun(cfg,undefined,{balanceVersion:6,experienceVersion:3});
      const before=operationProfile(old), after=operationProfile(current);
      for (const key of ['points','enemies','waveXp','escortCount','escortXp','interval','bossScale'] as const) expect(after[key]).toEqual(before[key]);
      expect(current.weapons).toEqual(old.weapons);
      expect(current.wallMaxHp).toBe(old.wallMaxHp);
      expect(current.spawnPlan.reduce((sum,entry)=>sum+entry.xp,0)).toBe(old.spawnPlan.reduce((sum,entry)=>sum+entry.xp,0));
      for (const id of stage.enemyIds) expect(waveStats(current,id,3).hp/waveStats(old,id,3).hp).toBeCloseTo(ADVANCED_TUNING.health);
      expect(pressure(current).bossDamage/pressure(old).bossDamage).toBeCloseTo(ADVANCED_TUNING.damage);
      expect(waveAttackDamage(current,3,100)/waveAttackDamage(old,3,100)).toBeCloseTo(ADVANCED_TUNING.damage);
      for (let index=0; index<after.waves.length; index++) {
        const counts=bodies(after.waves[index]), previous=bodies(before.waves[index]);
        expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(Object.values(previous).reduce((a,b)=>a+b,0));
        expect(counts.H??0).toBeLessThanOrEqual(1);expect(counts.D??0).toBeLessThanOrEqual(1);
        const groups=after.formations![index]!;
        for(const [code,count] of Object.entries(counts)) expect(groups.filter(group=>group.code===code).reduce((sum,group)=>sum+group.count,0)).toBe(count);
        const specialists=groups.filter(group=>['P','H','D'].includes(group.code)).sort((a,b)=>a.offset-b.offset);
        specialists.forEach((group,i)=>{
          expect(group.count).toBeLessThanOrEqual(2);
          if(i)expect(group.offset-specialists[i-1].offset).toBeGreaterThanOrEqual(ADVANCED_TUNING.specialistGap);
        });
      }
      expect(restoreRun(current)).toEqual(current);
    }
  });

  it('preserves hundred-wave enemy balance independently of its new XP curve', () => {
    const cfg={...config,mode:'hundred' as const,difficulty:'easy' as const};
    const old=createRun(cfg,undefined,{balanceVersion:5,experienceVersion:3});
    const current=createRun(cfg,undefined,{balanceVersion:6,experienceVersion:3});
    expect(operationProfile(current)).toEqual(operationProfile(old));
    expect(current.spawnPlan).toEqual(old.spawnPlan);
    expect(waveStats(current,'E03',80)).toEqual(waveStats(old,'E03',80));
    expect(restoreRun(current)).toEqual(current);
  });
});
