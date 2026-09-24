import { describe,it,expect } from 'vitest';
import { STAGES } from '../../src/data/content';
import { MAIN_IDS,SIDE_IDS } from '../../src/data/campaign';
import { stageProfile,operationProfile,previousStageProfile } from '../../src/data/progression';
import { createRun as versionedRun,restoreRun,stepRun,command } from '../../src/sim/engine';
import { createEnemy,hitEnemy } from '../../src/sim/combat';
import { deepLegalNodes } from '../../src/sim/deep-tree';
import { DEEP_NODE_MAP } from '../../src/data/deep-trees';
import { openDraft } from '../../src/sim/draft';
import { nextIntel } from '../../src/sim/operations';
const createRun=(...args:Parameters<typeof versionedRun>)=>versionedRun(args[0],args[1]??'0.5.0-dev.2',args[2]);

const run=(stageId:typeof STAGES[number]['id'])=>createRun({stageId,squadIds:['C01'],captainId:'C01',seed:101});
describe('progressive stage schedules and skill budgets',()=>{
  it('strictly increases waves and regular enemy totals along each campaign',()=>{
    expect(MAIN_IDS.map(id=>stageProfile(id).waves.length)).toEqual([5,7,8,9,10,12,13,14,16,17,18,20]);
    expect(MAIN_IDS.map(id=>stageProfile(id).points)).toEqual([10,14,16,18,20,24,26,28,32,32,32,32]);
    expect(SIDE_IDS.map(id=>stageProfile(id).waves.length)).toEqual([8,9,10]);
    for(const ids of [MAIN_IDS,SIDE_IDS])for(let i=1;i<ids.length;i++)expect(stageProfile(ids[i]).enemies).toBeGreaterThan(stageProfile(ids[i-1]).enemies);
  });
  for(const stage of STAGES)it(`${stage.id}: preview, spawns, XP cap, boss clock and restore agree`,()=>{
    const s=run(stage.id),p=stageProfile(stage.id);
    expect(s.operationVersion).toBe(3);expect(s.spawnPlan).toHaveLength(p.enemies);expect(s.wavePlan).toHaveLength(p.waves.length);
    expect(s.spawnPlan.reduce((n,e)=>n+e.xp,0)).toBe(p.points*30-p.escortXp!);
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
    command(s,{type:'finish-boss-intro'});s.tick=p.deadline*30+300;stepRun(s);expect(s.outcome).toBeNull();expect(restoreRun(s)).toEqual(s);
    s.bossKilled=true;s.enemies=[];s.projectiles=[];s.scheduled=[];stepRun(s);expect(s.outcome).toBe('victory');
  });
  it('restores an existing unversioned schedule without changing counts, clocks or point prices',()=>{
    const old=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101},undefined,{legacyOperations:true,legacyCommonSkills:true});delete old.skillCostVersion;
    expect(old.operationVersion).toBeUndefined();expect(operationProfile(old)).toMatchObject({points:24,bossAt:360,deadline:480});
    expect(old.wavePlan).toHaveLength(8);expect(old.spawnPlan.reduce((n,e)=>n+e.xp,0)).toBe(720);expect(restoreRun(old)).toEqual(old);
    const forged=structuredClone(old) as unknown as Record<string,unknown>;forged.operationVersion=4;expect(()=>restoreRun(forged)).toThrow();
  });
});

describe('unlimited operation regression coverage',()=>{
  for(const stage of STAGES)for(const mode of ['easy','hard','four','no-skill','two-evolutions'] as const){
    if(stage.id.startsWith('X')&&!['easy','hard'].includes(mode))continue;
    it(`${stage.id}/${mode}: expands the total once and reserves escort XP within the point budget`,()=>{
      const difficulty=mode==='easy'?'easy':'hard',challengeId=mode==='easy'||mode==='hard'?null:mode;
      const s=createRun({stageId:stage.id,difficulty,challengeId,squadIds:['C01'],captainId:'C01',seed:211});
      const p=operationProfile(s),old=previousStageProfile(stage.id,difficulty,{challengeId});
      expect(s.spawnPlan.length).toBe(Math.round(old.enemies*1.3));
      expect(p.waves.length).toBe(Math.round(old.waves.length*1.3));
      expect(p.interval).toBe(25);expect(p.unlimited).toBe(true);
      expect(p.points).toBe(2*Math.round(old.points*1.3/2));
      expect(s.spawnPlan.reduce((n,e)=>n+e.xp,0)+p.escortXp!).toBe(p.points*30);
      expect(s.evolutionLimit).toBe(challengeId==='two-evolutions'?2:s.config.squadIds.length);
      expect(Math.max(...s.spawnPlan.map(e=>e.at))).toBeLessThan(p.bossAt*30);
      expect(restoreRun(s)).toEqual(s);
    });
  }
  it('preserves the v2 schedule, 32 zero-XP escorts and original timeout after restore',()=>{
    const s=createRun({stageId:'S03',squadIds:['C01'],captainId:'C01',seed:101},undefined,{operationVersion:2});
    const p=operationProfile(s);expect(p).toEqual(previousStageProfile('S03'));
    expect(restoreRun(s)).toEqual(s);
    s.tick=p.bossAt*30-1;s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.weapons[0].nextAttack=999999;stepRun(s);
    expect(s.enemies.filter(e=>!e.defId.startsWith('B'))).toHaveLength(32);
    expect(s.enemies.every(e=>e.xp===0)).toBe(true);
    command(s,{type:'finish-boss-intro'});s.tick=p.deadline*30-1;stepRun(s);
    expect(s.outcome).toBe('timeout');expect(restoreRun(s)).toEqual(s);
  });
  it('awards the complete larger point budget from actual enemy kills, including escorts',()=>{
    const s=run('S12'),p=operationProfile(s);s.enemies=[];
    const defeat=(e:ReturnType<typeof createEnemy>)=>hitEnemy(s,e,{source:'C01',skill:'xp-regression',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
    for(const entry of s.spawnPlan)defeat(createEnemy(s,entry.defId,195,100,entry.xp,entry.wave));
    expect(s.choicesEarned).toBe(30);
    s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.tick=p.bossAt*30-1;s.weapons[0].nextAttack=999999;stepRun(s);
    for(const e of s.enemies.filter(e=>!e.defId.startsWith('B')))defeat(e);
    expect(s.xp).toBe(960);expect(s.choicesEarned).toBe(32);
  });
});

it('spends and restores all 32 skill points, exceeding the old 24-node save limit',()=>{
  const s=createRun({stageId:'S12',squadIds:['C01','C02','C03','C04','C05'],captainId:'C01',seed:211});
  s.xp=960;s.choicesEarned=32;openDraft(s);
  for(let i=0;i<32;i++){
    const id=deepLegalNodes(s).find(id=>DEEP_NODE_MAP[id].kind!=='ultimate')!;
    expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id})).toBe(true);
    expect(restoreRun(s)).toEqual(s);
  }
  expect(s.choicesSpent).toBe(32);expect(s.treeNodes).toHaveLength(32);expect(s.draft).toBeNull();
});
