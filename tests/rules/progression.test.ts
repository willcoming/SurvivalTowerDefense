import { describe,it,expect } from 'vitest';
import { STAGES } from '../../src/data/content';
import { MAIN_IDS,SIDE_IDS } from '../../src/data/campaign';
import { stageProfile,operationProfile } from '../../src/data/progression';
import { createRun,restoreRun,stepRun,command } from '../../src/sim/engine';
import { createEnemy,hitEnemy } from '../../src/sim/combat';
import { nextIntel } from '../../src/sim/operations';

const run=(stageId:typeof STAGES[number]['id'])=>createRun({stageId,squadIds:['C01'],captainId:'C01',seed:101});
describe('progressive stage schedules and skill budgets',()=>{
  it('strictly increases waves and regular enemy totals along each campaign',()=>{
    expect(MAIN_IDS.map(id=>stageProfile(id).waves.length)).toEqual([4,5,6,7,8,9,10,11,12,13,14,15]);
    expect(MAIN_IDS.map(id=>stageProfile(id).points)).toEqual([8,10,12,14,16,18,20,22,24,24,24,24]);
    expect(SIDE_IDS.map(id=>stageProfile(id).waves.length)).toEqual([6,7,8]);
    for(const ids of [MAIN_IDS,SIDE_IDS])for(let i=1;i<ids.length;i++)expect(stageProfile(ids[i]).enemies).toBeGreaterThan(stageProfile(ids[i-1]).enemies);
  });
  for(const stage of STAGES)it(`${stage.id}: preview, spawns, XP cap, boss clock and restore agree`,()=>{
    const s=run(stage.id),p=stageProfile(stage.id);
    expect(s.operationVersion).toBe(2);expect(s.spawnPlan).toHaveLength(p.enemies);expect(s.wavePlan).toHaveLength(p.waves.length);
    expect(s.spawnPlan.reduce((n,e)=>n+e.xp,0)).toBe(p.points*30);
    for(let i=0;i<p.waves.length;i++){
      const wave=s.spawnPlan.filter(e=>e.wave===i+1);
      expect(wave.length).toBe(p.waves[i].split(' ').reduce((n,t)=>n+Number(t.slice(1)),0));
      expect(wave.reduce((n,e)=>n+e.xp,0)).toBe(p.waveXp[i]);
      expect(wave.every(e=>e.at>=i*p.interval*30&&e.at<(i+1)*p.interval*30&&e.xp>0)).toBe(true);
    }
    expect(restoreRun(s)).toEqual(s);
    const forged=structuredClone(s);forged.spawnPlan[0].xp++;expect(()=>restoreRun(forged)).toThrow();
    const before=structuredClone(s);before.enemies=[];
    const enemy=createEnemy(before,'E01',195,200,99999);
    hitEnemy(before,enemy,{source:'C01',skill:'budget-test',raw:99999,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
    expect(before.choicesEarned).toBe(p.points);
    s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.weapons[0].nextAttack=99999;s.tick=p.bossAt*30-2;
    expect(nextIntel(s)).toEqual([]);stepRun(s);expect(s.bossSpawned).toBe(false);stepRun(s);expect(s.bossSpawned).toBe(true);
    expect(s.enemies.filter(e=>e.defId===stage.bossId)).toHaveLength(1);expect(restoreRun(s)).toEqual(s);
    command(s,{type:'finish-boss-intro'});s.tick=p.deadline*30-1;stepRun(s);expect(s.outcome).toBe('timeout');
  });
  it('restores an existing unversioned schedule without changing counts, clocks or point prices',()=>{
    const old=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101},undefined,{legacyOperations:true,legacyCommonSkills:true});delete old.skillCostVersion;
    expect(old.operationVersion).toBeUndefined();expect(operationProfile(old)).toMatchObject({points:24,bossAt:360,deadline:480});
    expect(old.wavePlan).toHaveLength(8);expect(old.spawnPlan.reduce((n,e)=>n+e.xp,0)).toBe(720);expect(restoreRun(old)).toEqual(old);
    const forged=structuredClone(old) as unknown as Record<string,unknown>;forged.operationVersion=3;expect(()=>restoreRun(forged)).toThrow();
  });
});
