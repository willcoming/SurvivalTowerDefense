import { describe, expect, it } from 'vitest';
import { battleLevelCost, battleXpAt } from '../../src/data/battle-experience';
import { STAGES } from '../../src/data/content';
import { operationProfile } from '../../src/data/progression';
import { createRun, restoreRun } from '../../src/sim/engine';
import { createEnemy, hitEnemy } from '../../src/sim/combat';
import { battleExperience } from '../../src/sim/experience';
import type { RunState } from '../../src/sim/types';

const config = { stageId:'S01', squadIds:['C01'], captainId:'C01', seed:101 } as const;
const run = () => createRun({...config,squadIds:[...config.squadIds]});
function earn(s: RunState, xp: number) {
  const enemy = createEnemy(s,'E01',195,100,xp,1);
  hitEnemy(s,enemy,{source:'C01',skill:'experience-test',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
}

describe('one point per battle level', () => {
  it('uses rising XP boundaries, restores odd points and handles multiple levels per kill', () => {
    const s=run();
    expect(battleExperience(s)).toMatchObject({level:1,earned:0,current:0,required:30});
    earn(s,29); expect(s.choicesEarned).toBe(0);
    earn(s,1); expect(s.choicesEarned).toBe(1);
    expect(battleExperience(s)).toMatchObject({level:2,current:0});
    expect(restoreRun(s)).toEqual(s);
    earn(s,74); expect(s.choicesEarned).toBe(2);
    earn(s,1); expect(s.choicesEarned).toBe(3);
    earn(s,150); expect(s.choicesEarned).toBe(6);
    expect(battleExperience(s)).toMatchObject({level:7,current:0});
    expect(s.draft).toBeNull(); expect(restoreRun(s)).toEqual(s);
  });

  for(const stage of STAGES)it(`${stage.id}: keeps the full authored point budget`, () => {
    const s=createRun({...config,stageId:stage.id,squadIds:['C01']}),p=operationProfile(s);
    const xp=s.spawnPlan.reduce((sum,e)=>sum+e.xp,0);
    earn(s,xp-1); expect(s.choicesEarned).toBe(p.points-1);
    earn(s,1); expect(s.choicesEarned).toBe(p.points);
    expect(battleExperience(s)).toMatchObject({level:p.points+1,capped:true});
    earn(s,999); expect(s.choicesEarned).toBe(p.points);
    expect(restoreRun(s)).toEqual(s);
  });

  it('keeps unversioned saved battles on their original 60 XP / 2 point rule', () => {
    const saved=createRun({...config,squadIds:['C01']},undefined,{experienceVersion:null});
    earn(saved,30); expect(saved.choicesEarned).toBe(0);
    const restored=restoreRun(saved);
    expect(restored.experienceVersion).toBeUndefined();
    expect(battleExperience(restored)).toMatchObject({required:60,pointsPerLevel:2});
    earn(restored,30); expect(restored.choicesEarned).toBe(2);
    expect(restoreRun(restored)).toEqual(restored);
  });

  it('retains the fixed 30 XP curve in version 1 saves', () => {
    const s=createRun({...config,squadIds:['C01']},undefined,{experienceVersion:1});
    earn(s,90);expect(s.choicesEarned).toBe(3);
    expect(battleExperience(s)).toMatchObject({required:30,level:4,current:0});
    expect(restoreRun(s)).toEqual(s);
    expect(s.spawnPlan.reduce((sum,e)=>sum+e.xp,0)).toBe(operationProfile(s).points*30);
  });

  it('checks every level boundary through the hundred-wave cap', () => {
    const s=createRun({...config,stageId:'S03',mode:'hundred',difficulty:'easy',squadIds:['C01']});
    expect(s.spawnPlan.reduce((sum,e)=>sum+e.xp,0)).toBe(battleXpAt(61));
    for(let level=1;level<=60;level++){
      expect(battleXpAt(level+1)-battleXpAt(level)).toBe(battleLevelCost(level));
      s.xp=battleXpAt(level+1)-1;expect(battleExperience(s)).toMatchObject({level,current:battleLevelCost(level)-1});
      s.xp++;expect(battleExperience(s)).toMatchObject({level:level+1,earned:level});
    }
  });

  it('rejects unsupported experience versions and mismatched points', () => {
    const s=run();earn(s,30);s.choicesEarned=2;
    expect(()=>restoreRun(s)).toThrow('技能點計數');
    s.choicesEarned=1;
    (s as unknown as {experienceVersion:number}).experienceVersion=3;
    expect(()=>restoreRun(s)).toThrow('戰鬥經驗版本');
  });
});
