import { describe,expect,it } from 'vitest';
import { CHARACTER_IDS } from '../../src/data/content';
import { FORM_MAP, attackType } from '../../src/data/forms';
import { REWORKED_TREES, resolveSkillTree, ultimateForForm } from '../../src/data/reworked-skills';
import { deepTreesFor } from '../../src/data/deep-trees';
import { HUNDRED_PROFILE } from '../../src/data/hundred';
import { createRun, command, restoreRun, stepRun } from '../../src/sim/engine';
import { openDraft } from '../../src/sim/draft';
import { createEnemy,hitEnemy,hitWall,addShield } from '../../src/sim/combat';
import { deepLock,deepLegalNodes,deepPointCost } from '../../src/sim/deep-tree';
import { hasUltimate, stepUltimates,ultimateNodeId } from '../../src/sim/ultimates';
import { stepWeapons } from '../../src/sim/weapons';
import { captainDamageBonus, captainHaste } from '../../src/sim/captain-bonuses';
import type {CharacterId,FormId,RunState,ChallengeId} from '../../src/sim/types';
function funded(id:CharacterId='C01',form:FormId=`${id}-original`,challengeId:ChallengeId|null=null){const s=createRun({stageId:'S12',squadIds:[id],captainId:id,seed:101,forms:{[id]:form},challengeId});s.xp=780;s.choicesEarned=26;openDraft(s);return s;}
function buy(s:RunState,id:string){expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id}),id).toBe(true);}
function unlock(s:RunState,id:CharacterId){for(const n of deepTreesFor(id).find(t=>t.nodes.some(n=>n.kind==='ultimate'))!.nodes.slice(0,5))buy(s,n.id);}
function combat(s:RunState){s.draft=null;s.pauseReasons=[];s.phase='running';s.choicesEarned=s.choicesSpent;s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;const e=createEnemy(s,'E03',195,330,0,0);e.hp=e.maxHp=1e7;e.shield=0;e.speed=0;return e;}
describe('0.5 skill rework',()=>{
 it('has 192 slots, exactly 8 ultimates and 3 ordinary summer replacements per character',()=>{
  expect(REWORKED_TREES).toHaveLength(24);
  for(const id of CHARACTER_IDS){const trees=deepTreesFor(id);expect(trees).toHaveLength(3);const nodes=trees.flatMap(t=>t.nodes);expect(nodes).toHaveLength(24);expect(nodes.filter(n=>n.kind==='ultimate')).toHaveLength(1);expect(deepPointCost(nodes.map(n=>n.id))).toBe(25);
   let changed=0;for(const t of trees){expect(t.nodes).toHaveLength(8);const alt=resolveSkillTree(t,`${id}-summer`);for(let i=0;i<8;i++){expect(alt.nodes[i].id).toBe(t.nodes[i].id);expect(alt.nodes[i].parents).toEqual(t.nodes[i].parents);if(t.nodes[i].name!==alt.nodes[i].name&&t.nodes[i].kind!=='ultimate'){changed++;expect(i).toBe(2);}}}expect(changed).toBe(3);
  }
 });
 for(const id of CHARACTER_IDS)for(const theme of ['original','summer'] as const)it(`${id}-${theme}: unlock waits full cooldown, casts independently, then waits again`,()=>{
  const form:FormId=`${id}-${theme}`,s=funded(id,form);unlock(s,id);expect(s.choicesSpent).toBe(6);expect(restoreRun(s)).toEqual(s);expect(hasUltimate(s,id)).toBe(true);expect(command(s,{type:'cast'})).toBe(false);
  const e=combat(s),w=s.weapons[0],ready=w.ultimateReadyAt!;expect(ready).toBe(ultimateForForm(id,form).cooldown*30);s.tick=ready-1;w.heat=80;stepWeapons(s);stepUltimates(s);expect(s.stats.casts).toHaveLength(0);
  s.tick=ready;w.heat=80;stepUltimates(s);expect(s.stats.ultimateCasts).toEqual([{tick:ready,ownerId:id,formId:form}]);expect(w.ultimateReadyAt).toBe(ready+ultimateForForm(id,form).cooldown*30);stepUltimates(s);expect(s.stats.casts).toHaveLength(1);expect(s.events.some(e=>e.skill==='ultimate')).toBe(true);expect(attackType(s,id)).toBe(FORM_MAP[form].damageType);expect(e.hp).toBeGreaterThan(0);
 });
 it('ready ultimates wait for targets; pauses freeze simulation and cooldown',()=>{const s=funded();unlock(s,'C01');combat(s);const ready=s.weapons[0].ultimateReadyAt!;command(s,{type:'pause',reason:'user'});stepRun(s,90);expect(s.tick).toBe(0);expect(s.weapons[0].ultimateReadyAt).toBe(ready);command(s,{type:'resume',reason:'user'});s.tick=ready;s.enemies=[];stepUltimates(s);expect(s.stats.casts).toHaveLength(0);expect(s.weapons[0].ultimateReadyAt).toBe(ready);createEnemy(s,'E01',195,330,0,0);stepUltimates(s);expect(s.stats.casts).toHaveLength(1);});
 it('forbids ultimates in no-skill but keeps ordinary nodes and captain bonuses',()=>{const s=funded('C03','C03-original','no-skill');const tree=deepTreesFor('C03').find(t=>t.nodes[4].kind==='ultimate')!;for(const n of tree.nodes.slice(0,4))buy(s,n.id);expect(deepLock(s,tree.nodes[4].id)).toContain('禁止');const e=createEnemy(s,'B01',195,200);expect(captainDamageBonus(s,e,true,0,false)).toBe(.08);expect(deepLegalNodes(s).length).toBeGreaterThan(0);});
 it('supports five ultimates and limits the two-ultimate challenge',()=>{for(const challengeId of [null,'two-evolutions'] as const){const squad:CharacterId[]=['C01','C02','C03','C04','C05'];const s=createRun({stageId:'S12',squadIds:squad,captainId:'C01',seed:101,challengeId});s.xp=1200;s.choicesEarned=40;openDraft(s);unlock(s,'C01');unlock(s,'C02');if(challengeId)expect(deepLock(s,ultimateNodeId('C03'))).toContain('名額');else{for(const id of squad.slice(2))unlock(s,id);expect(s.evolvedCount).toBe(5);}}});
 it('rejects archived nodes and stops offering skills when a solo tree is complete',()=>{const s=funded();expect(deepLock(s,'C01-A/0')).toBe('未知節點');while(s.draft){const id=deepLegalNodes(s).find(id=>deepPointCost([id],s)<=s.draft!.pointTarget!-s.choicesSpent);expect(id).toBeTruthy();buy(s,id!);}expect(s.choicesSpent).toBe(25);expect(s.treeNodes).toHaveLength(24);expect(s.pauseReasons).not.toContain('upgrade');expect(restoreRun(s)).toEqual(s);});
 it('retains the ultimate gravity field when the normal field refreshes',()=>{const s=funded('C04');unlock(s,'C04');combat(s);s.tick=s.weapons[0].ultimateReadyAt!;stepUltimates(s);const field=s.fields.find(f=>f.ultimate)!;expect(field).toBeTruthy();for(let i=0;i<90;i++){s.tick++;stepWeapons(s);}expect(s.fields).toContain(field);});
 it('captain conditions provide modest, situational effects',()=>{const s=funded('C06');s.enemies=[];addShield(s,'test',100,90);hitWall(s,100,'E01');expect(s.shields[0].value).toBeCloseTo(10);const t=funded('C08');t.enemies=[];expect(captainHaste(t)).toBe(0);createEnemy(t,'E01',195,360);expect(captainHaste(t)).toBe(.1);});
 it('all summer attack packets use their form element, including reflection and DoT',()=>{for(const id of CHARACTER_IDS){const s=funded(id,`${id}-summer`),e=combat(s);hitEnemy(s,e,{source:id,skill:'burn',raw:100,damageType:'kinetic',armorIgnore:0,shieldMultiplier:1});expect(s.stats.damageByCharacter[id]).toBeGreaterThan(0);expect(attackType(s,id)).toBe(FORM_MAP[`${id}-summer`].damageType);}});
 it('hundred mode earns exactly 60 points from the unchanged 100 waves',()=>{expect(HUNDRED_PROFILE.points).toBe(60);expect(HUNDRED_PROFILE.waves).toHaveLength(100);expect(HUNDRED_PROFILE.waveXp.reduce((a,b)=>a+b,0)).toBe(1800);});
});

it('summer overclock holds heat at 70 without reducing the heat damage passive',()=>{
 const s=funded('C08','C08-summer');unlock(s,'C08');combat(s);const w=s.weapons[0];s.tick=w.ultimateReadyAt!;w.heat=90;stepUltimates(s);expect(w.heat).toBe(70);expect(w.cooling).toBe(false);for(let i=0;i<90;i++){s.tick++;stepWeapons(s);}expect(w.heat).toBe(70);
});
it('each acquired ultimate preserves its own timer and rejects impossible snapshots',()=>{
 const s=createRun({stageId:'S12',squadIds:['C01','C03'],captainId:'C01',seed:101});s.xp=360;s.choicesEarned=12;openDraft(s);unlock(s,'C01');unlock(s,'C03');expect(s.weapons.map(w=>w.ultimateReadyAt)).toEqual([960,900]);expect(restoreRun(s)).toEqual(s);s.weapons[0].ultimateReadyAt=100000;expect(()=>restoreRun(s)).toThrow('冷卻');
});
it('normal stage budgets, enemy waves and spawn properties are unchanged from 0.4',()=>{
 for(const stageId of ['S01','S06','S12','X03'] as const){const config={stageId,squadIds:['C01'] as CharacterId[],captainId:'C01' as const,seed:307,difficulty:'hard' as const};const current=createRun(config),previous=createRun(config,'0.4.0-dev.2');expect(current.spawnPlan).toEqual(previous.spawnPlan);expect(current.wavePlan).toEqual(previous.wavePlan);expect(current.enemies).toEqual(previous.enemies);}
});
it('a non-ultimate C02 chain build can return fire against a single target',()=>{
 const s=funded('C02');for(const n of deepTreesFor('C02')[0].nodes.slice(0,5))buy(s,n.id);buy(s,deepTreesFor('C02')[2].nodes[0].id);combat(s);stepWeapons(s);expect(s.events.some(e=>e.skill==='chain-return')).toBe(true);expect(s.evolvedCount).toBe(0);
});
