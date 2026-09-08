import { operationProfile } from '../../src/data/progression';
import { describe, expect, it } from 'vitest';
import { createRun, restoreRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { stepEnemies } from '../../src/sim/enemies';
import { waveStats } from '../../src/sim/operations';
import type { StageId } from '../../src/sim/types';

const run = (stageId: StageId = 'S01', version?: string) => createRun({stageId,squadIds:['C01'],captainId:'C01',seed:101}, version);
describe('0.4.0-dev.2 pressure tuning', () => {
  it('increases crowds without changing eight waves, 90 XP per wave or deterministic restoration', () => {
    const config={stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101} as const;
    const current=createRun({...config,squadIds:['C01']},undefined,{legacyOperations:true,legacyCommonSkills:true}), old=createRun({...config,squadIds:['C01']},'0.4.0-dev.1',{legacyOperations:true,legacyCommonSkills:true});
    expect(current.spawnPlan.length).toBeGreaterThan(old.spawnPlan.length);
    for(let wave=1;wave<=8;wave++)expect(current.spawnPlan.filter(p=>p.wave===wave).reduce((sum,p)=>sum+p.xp,0)).toBe(90);
    expect(restoreRun(structuredClone(current))).toEqual(current);
    expect(restoreRun(structuredClone(old))).toEqual(old);
  });
  it('ramps normal durability across chapters and preserves historical stats', () => {
    expect(waveStats(run(),'E01',9).hp).toBeCloseTo(140*1.06);
    expect(waveStats(run('S12'),'E01',9).hp).toBeCloseTo(140*1.35*1.12);
    expect(waveStats(run('S01','0.4.0-dev.1'),'E01',1).hp).toBe(140);
    expect(waveStats(run(),'E01',9).speed).toBeCloseTo(16*1.03);
  });
  it('gives bosses more durability and earlier attacks while retaining the full warning window', () => {
    const s=run();s.enemies=[];
    const boss=createEnemy(s,'B01',195,150);
    expect(boss.maxHp).toBeCloseTo(6500*1.25*operationProfile(s).bossScale);expect(boss.abilityAt).toBe(150);
    s.tick=149;stepEnemies(s);expect(boss.chargeKind).toBeNull();
    s.tick=150;stepEnemies(s);expect(boss.chargeUntil).toBe(210);
    expect(boss.abilityAt).toBe(150+336);
    s.tick=209;stepEnemies(s);expect(s.wallHp).toBe(1000);
    s.tick=210;stepEnemies(s);expect(s.wallHp).toBeCloseTo(1000-70*1.15);
    const old=run('S01','0.4.0-dev.1');
    expect(createEnemy(old,'B01',195,150).abilityAt).toBe(420);
  });
});
