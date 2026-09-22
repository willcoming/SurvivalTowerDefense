import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/balance-v1.json';
import { createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { operationProfile, stageProfile } from '../../src/data/progression';
import { pressure } from '../../src/sim/difficulty';
import { STAGES } from '../../src/data/content';
import type { RunConfig } from '../../src/sim/types';

describe('balance v2 compatibility', () => {
  it('retains all 66 version-one battle states byte-for-byte after 120 ticks', () => {
    for (const fixture of fixtures) {
      const state = createRun(fixture.config as RunConfig, '0.4.0-dev.2', { balanceVersion:1,operationVersion:2 });
      state.runId = 'compatibility-fixture'; stepRun(state,120);
      expect(createHash('sha256').update(JSON.stringify(state)).digest('hex'), `${state.config.stageId}/${state.config.challengeId??state.config.difficulty}`).toBe(fixture.sha256);
      const restored = restoreRun(state); stepRun(state,30); stepRun(restored,30); expect(restored).toEqual(state);
    }
  });
  it('defaults to v2 and restores each version without changing its rules', () => {
    for (const balanceVersion of [undefined,1,2] as const) {
      const state = createRun({stageId:'S09',difficulty:'hard',squadIds:['C02','C03','C05','C06'],captainId:'C02',seed:307},undefined,balanceVersion===undefined?{legacyBalance:true}:{balanceVersion});
      expect(state.balanceVersion).toBe(balanceVersion);
      const restored = restoreRun(state); expect(operationProfile(restored)).toEqual(operationProfile(state));expect(pressure(restored)).toEqual(pressure(state));
      stepRun(restored,180);stepRun(state,180);expect(restored).toEqual(state);
    }
    expect(createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101}).balanceVersion).toBe(2);
    expect(()=>createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101},undefined,{legacyBalance:true,balanceVersion:2})).toThrow();
  });
  it('keeps every stage/mode budget and makes previews use the actual challenge profile', () => {
    for (const stage of STAGES) for (const mode of ['easy','hard','four','no-skill','two-evolutions'] as const) {
      if(stage.id.startsWith('X')&&!['easy','hard'].includes(mode))continue;
      const difficulty=mode==='easy'?'easy':'hard',challengeId=mode==='easy'||mode==='hard'?null:mode;
      const config:RunConfig={stageId:stage.id,difficulty,challengeId,squadIds:['C02','C03','C05','C06'],captainId:'C02',seed:101};
      const current=createRun(config),previous=createRun(config,undefined,{balanceVersion:1});
      const profile=operationProfile(current),old=operationProfile(previous);
      for(const key of ['points','interval','bossAt','deadline','enemies','waveXp'] as const)expect(profile[key]).toEqual(old[key]);
      expect(profile.waves.length).toBe(old.waves.length);
      for(let wave=1;wave<=old.waves.length;wave++){
        const now=current.spawnPlan.filter(p=>p.wave===wave),before=previous.spawnPlan.filter(p=>p.wave===wave);
        expect(now.length).toBe(before.length);expect(now.reduce((n,p)=>n+p.xp,0)).toBe(before.reduce((n,p)=>n+p.xp,0));
      }
      expect(profile).toEqual(stageProfile(stage.id,difficulty,{challengeId}));
      expect(restoreRun(current)).toEqual(current);
    }
  });
});
