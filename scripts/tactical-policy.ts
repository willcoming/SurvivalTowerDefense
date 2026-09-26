import {createRun,command,restoreRun,stepRun} from '../src/sim/engine';
import {deepLegalNodes,deepNodeCost,deepPointCost} from '../src/sim/deep-tree';
import {DEEP_NODE_MAP} from '../src/data/deep-trees';
import {resolveSkillNode} from '../src/data/reworked-skills';
import {operationProfile} from '../src/data/progression';
import type {CharacterId,RunConfig,RunState} from '../src/sim/types';
export type Policy='concentrated'|'balanced'|'adaptive';
export const TEAMS:CharacterId[][]=[['C03','C05','C02','C06','C01'],['C08','C04','C07','C06','C01']];
export function pathsTo(id:string):string[][]{const n=DEEP_NODE_MAP[id];return n.parents.length?n.parents.flatMap(p=>pathsTo(p).map(path=>[...path,id])):[[id]];}
export function choose(s:RunState,policy:Policy){
 const legal=deepLegalNodes(s).filter(id=>deepNodeCost(id,s)<=s.draft!.pointTarget!-s.choicesSpent);
 const spent=(id:string)=>deepPointCost((s.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n].ownerId===id),s);
 const wave=s.spawnPlan[s.spawnCursor]?.wave??operationProfile(s).waves.length,kind=operationProfile(s).waveKinds?.[wave-1]??(wave%3===0?'armor':wave%3===1?'rush':'shield');
 const preferred:Record<CharacterId,string>={C01:kind==='shield'?'B':'A',C02:kind==='elite'?'B':'A',C03:kind==='rush'?'A':'B',C04:kind==='artillery'?'B':'A',C05:kind==='armor'?'A':'B',C06:kind==='artillery'?'C':'B',C07:kind==='rush'?'C':'A',C08:kind==='shield'?'C':'B'};
 const score=(id:string)=>{const n=DEEP_NODE_MAP[id],owner=n.ownerId as CharacterId,m=resolveSkillNode(n,s.config.forms?.[owner]).mods;
  const value=(m.damage??0)+(m.haste??0)+(m.crowdDamage??0)*.7+(m.guardDamage??0)*.6+(m.freshDamage??0)*.6+(m.targets??0)*.28+(m.jumps??0)*.25+(m.pierce??0)*.18+(m.autoShield??0)/250+(m.teamExposeDamage??0)*3+(m.teamControlDamage??0)*3+(m.chainReturn??0)*.4+(m.blastEcho??0)*.5;
  if(policy==='balanced')return -spent(owner)*10+value+(n.kind==='ultimate'?.5:0);
  if(policy==='concentrated')return -(Math.floor(spent(owner)/10)*s.config.squadIds.length+s.config.squadIds.indexOf(owner))*10+value+(n.kind==='ultimate'?1:0)+n.layer*.12;
  return -Math.floor(spent(owner)/6)*3+(n.treeId[4]===preferred[owner]?2:0)+value+n.layer*.18+(n.kind==='ultimate'?.6:0);
 };
 return legal.sort((a,b)=>score(b)-score(a)||a.localeCompare(b))[0];
}
export function play(config:RunConfig,content:string,balanceVersion:2|3|4|5,policy:Policy,checkRestore=false){
 let s=createRun(config,content,{balanceVersion}),restored=false,peak=0,stall=0;
 const limit=s.waveFlow?(operationProfile(s).waves.length+1)*600*30:Math.round((operationProfile(s).bossAt+300)*30);
 for(let guard=0;guard<limit*2&&!s.outcome&&s.tick<limit;guard++){
  if(s.bossIntro){command(s,{type:'finish-boss-intro'});continue;}
  if(s.waveFlow&&s.tick-s.waveFlow.startedAt>600*30)break;
  if(s.draft&&s.waveFlow){
   const shadow={...s,treeNodes:[...s.treeNodes!]},ids:string[]=[];
   for(let id=choose(shadow,policy);id;id=choose(shadow,policy)){
    ids.push(id);shadow.treeNodes=[...shadow.treeNodes,id];shadow.choicesSpent+=deepNodeCost(id,shadow);
    if(DEEP_NODE_MAP[id].kind==='ultimate')shadow.evolvedCount++;
   }
   if(!command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:ids}))throw Error('Rejected wave allocation');
   continue;
  }
  if(s.draft){const id=choose(s,policy);if(!id||!command(s,{type:'buy-node',offerId:s.draft.id,nodeId:id}))throw Error(`Rejected choice ${id}`);continue;}
  if(checkRestore&&!restored&&s.choicesSpent>=6){s=restoreRun(s);restored=true;}
  const before=s.tick;stepRun(s);if(s.tick===before&&++stall>5)throw Error(`Paused ${s.pauseReasons}`);else if(s.tick!==before)stall=0;
  peak=Math.max(peak,s.enemies.length);
  // Visual event history is consumed by the renderer in normal play and never affects the simulation.
  if(s.tick%300===0)s.events=[];
 }
 return {outcome:s.outcome??'timeout',hp:Math.round(s.wallHp),seconds:s.tick/30,shield:Math.round(s.stats.shieldAbsorbed),damage:s.stats.damageByCharacter,control:s.stats.controlTicks,casts:s.stats.casts.length,earned:s.choicesEarned,spent:s.choicesSpent,wave:s.waveFlow?.wave,allocations:[...new Set(s.stats.choices.map(c=>c.tick))].length,peak,restored,plan:s.treeNodes};
}
