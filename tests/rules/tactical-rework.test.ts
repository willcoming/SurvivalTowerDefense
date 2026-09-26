import {describe,it,expect} from 'vitest';
import {CHARACTER_IDS,STAGES} from '../../src/data/content';
import {deepTreesFor,DEEP_NODE_MAP} from '../../src/data/deep-trees';
import {resolveSkillTree} from '../../src/data/reworked-skills';
import {ULTIMATE_ENTRIES,isUnconditionalNode} from '../../src/data/tactical-skills';
import {createRun as versionedRun,command,restoreRun,stepRun} from '../../src/sim/engine';
import {openDraft} from '../../src/sim/draft';
import {deepLock,deepNodeCost} from '../../src/sim/deep-tree';
import {operationProfile,stageProfile} from '../../src/data/progression';
import {createEnemy,hitEnemy,addShield} from '../../src/sim/combat';
import {deepWeaponStats} from '../../src/sim/deep-weapons';
import type {CharacterId,RunConfig,DamagePacket} from '../../src/sim/types';
const createRun=(...args:Parameters<typeof versionedRun>)=>versionedRun(args[0],args[1]??'0.6.0-dev.1',args[2]);
const config=(owner:CharacterId='C01'):RunConfig=>({stageId:'S12',squadIds:[owner],captainId:owner,seed:101});
const funded=(owner:CharacterId)=>{const s=createRun(config(owner));s.xp=180;s.choicesEarned=6;openDraft(s);return s;};
describe('tactical skill and encounter v3',()=>{
 for(const owner of CHARACTER_IDS)it(`${owner}: both independent branches buy one ultimate at six points for either outfit`,()=>{
  const trees=deepTreesFor(owner),nodes=trees.flatMap(t=>t.nodes),ult=nodes.find(n=>n.kind==='ultimate')!;
  expect(nodes).toHaveLength(24);expect(nodes.filter(n=>n.kind==='ultimate')).toHaveLength(1);
  expect(ult.parents).toEqual(ULTIMATE_ENTRIES[owner].map(b=>`${owner}-${b}4/3`));
  for(const theme of ['original','summer'] as const){
   for(const tree of trees){const resolved=resolveSkillTree(tree,`${owner}-${theme}`);expect(resolved.nodes.filter(isUnconditionalNode).length).toBeLessThanOrEqual(2);expect(resolved.nodes.filter(n=>!isUnconditionalNode(n)).length).toBeGreaterThanOrEqual(4);expect(resolved.nodes.map(n=>n.parents)).toEqual(tree.nodes.map(n=>n.parents));expect(new Set(resolved.nodes.map(n=>JSON.stringify(n.mods))).size).toBe(resolved.nodes.length);}
   for(const entry of ULTIMATE_ENTRIES[owner]){
    const s=funded(owner);s.config.forms={[owner]:`${owner}-${theme}`};expect(deepLock(s,ult.id)).not.toBeNull();
    for(const i of [0,1,2,3]){const nodeId=`${owner}-${entry}4/${i}`;expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId})).toBe(true);}
    expect(deepLock(s,ult.id)).toBeNull();expect(deepNodeCost(ult.id,s)).toBe(2);
    expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:ult.id})).toBe(true);expect(s.choicesSpent).toBe(6);expect(s.evolvedCount).toBe(1);expect(deepLock(s,ult.id)).toBe('已取得');expect(restoreRun(s)).toEqual(s);
   }
  }
 });
 it('keeps old single-parent skills and immutable replayed snapshots separate',()=>{
  for(const version of ['0.5.0-dev.1','0.5.0-dev.2','0.6.0-dev.1']){
   const s=createRun(config(),version);expect(s.balanceVersion).toBe(version==='0.6.0-dev.1'?3:2);stepRun(s,90);const t=restoreRun(s);stepRun(s,60);stepRun(t,60);expect(t).toEqual(s);
   const nodes=deepTreesFor('C01',s).flatMap(t=>t.nodes);expect(nodes.find(n=>n.kind==='ultimate')!.parents.length).toBe(version==='0.6.0-dev.1'?2:1);
   expect(deepLock(s,version==='0.6.0-dev.1'?'C01-A3/0':'C01-A4/0')).toBe('未知節點');
  }
 });
 it('conditional weapon damage triggers only for its declared target state and never strengthens an ultimate',()=>{
  const s=createRun(config('C01'));s.treeNodes=[deepTreesFor('C01').flatMap(t=>t.nodes).find(n=>n.mods.crowdDamage)!.id];s.enemies=[];
  const target=createEnemy(s,'E01',195,240);target.hp=target.maxHp=10000;target.armor=target.shield=0;
  const p:DamagePacket={source:'C01',skill:'weapon',tacticalWeapon:true,raw:100,damageType:'plasma',armorIgnore:0,shieldMultiplier:1};
  hitEnemy(s,target,p);expect(target.maxHp-target.hp).toBeCloseTo(100);
  createEnemy(s,'E01',200,250);createEnemy(s,'E01',190,250);const hp=target.hp;hitEnemy(s,target,p);expect(hp-target.hp).toBeCloseTo(124);
  const before=target.hp;hitEnemy(s,target,{...p,skill:'ultimate',tacticalWeapon:false});expect(before-target.hp).toBeCloseTo(100);
 });
 it('shield haste stops when its enabling state expires',()=>{
  const s=createRun(config('C06'));s.treeNodes=['C06-C4/3'];const w=s.weapons[0],before=deepWeaponStats(s,w).interval;
  addShield(s,'test',100,30);expect(deepWeaponStats(s,w).interval).toBeLessThan(before);s.tick=31;expect(deepWeaponStats(s,w).interval).toBe(before);
 });
 for(const key of ['markedHaste','pressureHaste'] as const)it(`${key} requires a live enabling target`,()=>{
  const node=CHARACTER_IDS.flatMap(id=>deepTreesFor(id).flatMap(t=>t.nodes)).find(n=>n.mods[key])!;
  const s=createRun(config(node.ownerId as CharacterId));s.treeNodes=[node.id];s.enemies=[];
  const base=deepWeaponStats(s,s.weapons[0]).interval;
  const e=createEnemy(s,'E01',195,key==='pressureHaste'?350:400);
  if(key==='markedHaste'){e.exposureUntil=30;}
  expect(deepWeaponStats(s,s.weapons[0]).interval).toBeLessThan(base);
  if(key==='markedHaste')s.tick=31;else e.y=349;
  expect(deepWeaponStats(s,s.weapons[0]).interval).toBe(base);
  e.hp=0;e.y=400;e.exposureUntil=999;
  expect(deepWeaponStats(s,s.weapons[0]).interval).toBe(base);
 });
 for(const stage of STAGES)for(const mode of ['easy','hard','four','no-skill','two-evolutions'] as const){
  if(stage.id.startsWith('X')&&!['easy','hard'].includes(mode))continue;
  it(`${stage.id}/${mode}: preserves budgets and replays the full authored formation`,()=>{
   const c={...config(),stageId:stage.id,difficulty:mode==='easy'?'easy' as const:'hard' as const,challengeId:['easy','hard'].includes(mode)?null:mode as 'four'|'no-skill'|'two-evolutions'};
   const s=createRun(c),p=operationProfile(s),old=createRun(c,'0.5.0-dev.2'),b=operationProfile(old);
   expect(s.balanceVersion).toBe(3);for(const key of ['points','interval','enemies','waveXp','bossAt'] as const)expect(p[key]).toEqual(b[key]);expect(p.waves.length).toBe(b.waves.length);
   expect(s.spawnPlan.length).toBe(p.enemies+p.escortCount!);expect(s.spawnPlan.reduce((v,n)=>v+n.xp,0)).toBe(p.points*30);expect(p.formations).toHaveLength(p.waves.length);expect(p).toEqual(stageProfile(stage.id,c.difficulty,{balanceVersion:3,challengeId:c.challengeId}));
   expect(p.waveKinds!.every((kind,i)=>i%4!==3||kind==='respite')).toBe(true);
   expect(new Set(s.spawnPlan.filter(n=>n.wave===p.waves.length+1).map(n=>n.at)).size).toBe(2);
   if(mode==='easy'&&['S01','S02','S03'].includes(stage.id))expect(s.spawnPlan.filter(n=>n.wave<=2)).toEqual(old.spawnPlan.filter(n=>n.wave<=2));
   expect(restoreRun(s)).toEqual(s);
   if(mode==='no-skill')expect(deepLock(s,deepTreesFor('C01',s)[0].nodes[4].id)).toContain('禁止');
  });
 }
 it('hundred mode retains 100 waves / 60 points and recovery windows in every decade',()=>{
  const s=createRun({...config(),stageId:'S03',difficulty:'easy',mode:'hundred'}),p=operationProfile(s);expect(p.waves).toHaveLength(100);expect(p.points).toBe(60);expect(s.spawnPlan.reduce((v,n)=>v+n.xp,0)).toBe(1800);
  let pressure=0;for(const kind of p.waveKinds!){pressure=kind==='respite'?0:pressure+1;expect(pressure).toBeLessThanOrEqual(3);}
  for(let i=0;i<100;i+=10){expect(p.waveKinds![i+8]).toBe('respite');expect(p.waveKinds![i+9]).toBe('elite');}
  expect(restoreRun(s)).toEqual(s);
 });
 it('has no missing, cyclic or cross-character prerequisite edges',()=>{
  for(const owner of CHARACTER_IDS){const visit=(id:string,path=new Set<string>())=>{expect(path.has(id)).toBe(false);const node=DEEP_NODE_MAP[id];expect(node.ownerId).toBe(owner);for(const parent of node.parents)visit(parent,new Set([...path,id]));};deepTreesFor(owner).flatMap(t=>t.nodes).forEach(n=>visit(n.id));}
 });
});
