import {describe,it,expect} from 'vitest';
import {createRun,restoreRun} from '../../src/sim/engine';
import {operationProfile} from '../../src/data/progression';
import {battleExperience} from '../../src/sim/experience';
import {battlePointCapacity,battleXpAt} from '../../src/data/battle-experience';
import {createEnemy,hitEnemy} from '../../src/sim/combat';
import {syncDeepWeapon} from '../../src/sim/deep-tree';
import {REWORKED_TREES} from '../../src/data/reworked-skills';
import type {RunConfig,RunState} from '../../src/sim/types';
const config:RunConfig={stageId:'S01',difficulty:'easy',squadIds:['C01','C02','C04','C05','C06'],captainId:'C02',seed:101};
function cumulative(s:RunState,wave:number){s.xp=operationProfile(s).waveXp.slice(0,wave).reduce((a,b)=>a+b,0);return battleExperience(s).earned;}
describe('separate, versioned skill point pacing',()=>{
 it('keeps a first-wave choice and preserves growth through the hundred-wave final allocation',()=>{
  const cfg={...config,stageId:'S03' as const,mode:'hundred' as const};const old=createRun(cfg,undefined,{experienceVersion:2}),versionThree=createRun(cfg,undefined,{experienceVersion:3}),s=createRun(cfg),profile=operationProfile(s);
  expect([1,10,25,50,99,100].map(w=>cumulative(old,w))).toEqual([5,24,38,46,59,60]);
  expect([1,10,25,50,99,100].map(w=>cumulative(versionThree,w))).toEqual([1,7,16,31,60,60]);
  expect([1,10,25,50,99,100].map(w=>cumulative(s,w))).toEqual([1,6,15,30,60,60]);
  let previous=0,choices=0;for(let wave=1;wave<=99;wave++){const earned=cumulative(s,wave);if(earned>previous)choices++;previous=earned;expect(profile.waveXp[wave-1]).toBeGreaterThan(0);}
  expect(choices).toBe(60);expect(profile.waveXp[99]).toBe(0);expect(profile.points).toBe(60);
 });
 it('campaign uses its own curve and funds all points before the boss allocation ends',()=>{
  const old=createRun(config,undefined,{experienceVersion:2}),s=createRun(config);
  expect([1,5,10].map(w=>cumulative(old,w))).toEqual([3,12,19]);expect([1,5,10].map(w=>cumulative(s,w))).toEqual([1,9,20]);
  const hundred=createRun({...config,stageId:'S03',mode:'hundred'});expect(battleExperience(createRun(config)).required).toBe(30);expect(battleExperience(hundred).required).toBe(40);
  s.xp=30;hundred.xp=30;expect(battleExperience(s).earned).toBe(1);expect(battleExperience(hundred).earned).toBe(0);
  expect(operationProfile(s).waveXp.reduce((a,b)=>a+b,0)).toBe(battleXpAt(21));
 });
 it('only changes XP, preserving the same authored enemies, times, lanes and combat tuning',()=>{
  for(const mode of [undefined,'hundred'] as const){const cfg={...config,stageId:mode==='hundred'?'S03' as const:'S01' as const,mode};const old=createRun(cfg,undefined,{experienceVersion:2}),s=createRun(cfg);
   const entries=(r:RunState)=>r.spawnPlan.map(({xp,...entry})=>entry);expect(entries(s)).toEqual(entries(old));
   expect(s.enemies.map(({xp,...e})=>e)).toEqual(old.enemies.map(({xp,...e})=>e));
   const withoutXp=(r:RunState)=>{const {waveXp,escortXp,...profile}=operationProfile(r);return profile;};expect(withoutXp(s)).toEqual(withoutXp(old));
  }
 });
 it('awards only the authored XP on death, once, with no wave bonus or XP multiplier',()=>{
  const s=createRun({...config,stageId:'S03',mode:'hundred'});const entry=s.spawnPlan[0],before=s.xp,e=createEnemy(s,entry.defId,195,100,entry.xp,1);
  const packet={source:'C01' as const,skill:'xp-proof',raw:1e9,damageType:'plasma' as const,armorIgnore:1,shieldMultiplier:1};hitEnemy(s,e,packet);expect(s.xp-before).toBe(entry.xp);hitEnemy(s,e,packet);expect(s.xp-before).toBe(entry.xp);
  const summon=createEnemy(s,'E01',195,100,0,1);hitEnemy(s,summon,packet);expect(s.xp-before).toBe(entry.xp);expect(s.choicesEarned).toBe(battleExperience(s).earned);
 });
 it('caps points at the actual purchasable node cost, including ultimate restrictions',()=>{
  for(const count of [1,2,4,5])for(const challengeId of [null,'no-skill','two-evolutions'] as const){const cfg={...config,squadIds:config.squadIds.slice(0,count),captainId:'C01' as const,challengeId};
   const nodes=REWORKED_TREES.filter(t=>cfg.squadIds.includes(t.ownerId as 'C01')).flatMap(t=>t.nodes);const ordinary=nodes.filter(n=>n.kind!=='ultimate').length,ultimates=challengeId==='no-skill'?0:Math.min(challengeId==='two-evolutions'?2:count,count);
   expect(battlePointCapacity(cfg)).toBe(ordinary+ultimates*2);const s=createRun({...cfg,stageId:'S12'});s.xp=1e9;expect(battleExperience(s).earned).toBe(Math.min(32,ordinary+ultimates*2));if(!challengeId){const h=createRun({...cfg,stageId:'S03',mode:'hundred'});h.xp=1e9;expect(battleExperience(h).earned).toBe(Math.min(60,ordinary+ultimates*2));}
  }
 });
 it('restores version-2 earned and spent points without recalculation or clearing',()=>{
  for(const mode of [undefined,'hundred'] as const){const s=createRun({...config,stageId:mode==='hundred'?'S03':'S01',mode},undefined,{experienceVersion:2});s.xp=battleXpAt(4);s.choicesEarned=3;s.choicesSpent=3;s.treeNodes=['C01-A4/0','C01-A4/1','C01-A4/2'];s.stats.choices=s.treeNodes.map(nodeId=>({tick:s.tick,nodeId}));syncDeepWeapon(s,'C01');
   const before=structuredClone(s),restored=restoreRun(s);expect(restored).toEqual(before);expect(restored.experienceVersion).toBe(2);expect(battleExperience(restored)).toMatchObject({earned:3,required:45});
   const e=createEnemy(restored,'E01',195,100,45,1);hitEnemy(restored,e,{source:'C01',skill:'old-run',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});expect(restored.choicesEarned).toBe(4);expect(restored.choicesSpent).toBe(3);expect(restoreRun(restored)).toEqual(restored);
  }
 });
});
