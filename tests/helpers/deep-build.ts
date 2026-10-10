import { PRE_REWORK_VERSION } from '../../src/data/forms';
import { CHARACTER_IDS, CONTENT_VERSION } from '../../src/data/content';
import { operationProfile } from '../../src/data/progression';
import { DEEP_NODE_MAP, COMMON_TREE, CHARACTER_TREES, deepTreesFor } from '../../src/data/deep-trees';
import { command, createRun as createVersionedRun, restoreRun, stepRun } from '../../src/sim/engine';
import { deepLegalNodes, deepPointCost, deepNodeCost, deepLock } from '../../src/sim/deep-tree';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import type { CharacterId, RunConfig, RunState } from '../../src/sim/types';

export function pathTo(id:string):string[]{
  const n=DEEP_NODE_MAP[id];if(!n)throw new Error(`Unknown node ${id}`);
  const parents=n.requires==='any'?n.parents.slice(0,1):n.parents;
  return [...new Set([...parents.flatMap(pathTo),id])];
}
export function fillCharacterPlan(plan:string[],squad:CharacterId[],budget=24){
  for(const n of DEEP_NODES)if(n.ownerId!=='common'&&squad.includes(n.ownerId)&&n.kind!=='ultimate'&&!plan.includes(n.id)&&deepPointCost(plan)<budget&&(n.requires==='all'?n.parents.every(p=>plan.includes(p)):!n.parents.length||n.parents.some(p=>plan.includes(p))))plan.push(n.id);
  if(deepPointCost(plan)!==budget)throw new Error('Cannot fill character point budget');
  return plan;
}
export function buildPlan(terminal:string,budget=5){
  const owner=DEEP_NODE_MAP[terminal].ownerId as CharacterId;
  const squad=[owner,...(['C03','C05','C02','C06','C04','C01'] as CharacterId[]).filter(id=>id!==owner)].slice(0,5);
  const others=['C03-B/8','C05-B/7','C02-A/9'].filter(id=>DEEP_NODE_MAP[id].ownerId!==owner&&squad.includes(DEEP_NODE_MAP[id].ownerId as CharacterId)).slice(0,2);
  const paths=[pathTo(terminal),...others.map(pathTo)],plan:string[]=[];
  for(const p of paths)plan.push(...p);
  if(budget===7){const other=CHARACTER_TREES.find(t=>t.ownerId===owner&&t.id!==DEEP_NODE_MAP[terminal].treeId)!;plan.push(other.nodes[0].id,other.nodes[1].id);}
  fillCharacterPlan(plan,squad);
  if(deepPointCost(plan)!==24||new Set(plan).size!==plan.length)throw new Error('Invalid 24-point policy');
  return {squad,owner,plan};
}
export const CURRENT_TERMINALS=CHARACTER_IDS.flatMap(owner=>deepTreesFor(owner,{contentVersion:CONTENT_VERSION}).flatMap(tree=>tree.nodes)).filter(node=>node.kind==='ultimate');

/** Fixed current-version policy. Budgets count points, including a two-point ultimate. */
export function buildCurrentPlan(terminal:string,subjectPoints=6,totalPoints=24){
  const node=CURRENT_TERMINALS.find(node=>node.id===terminal);
  if(!node)throw new Error(`Unknown current ultimate ${terminal}`);
  const owner=node.ownerId as CharacterId;
  const squad=[owner,...(['C03','C05','C02','C06','C04','C01'] as CharacterId[]).filter(id=>id!==owner)].slice(0,5);
  const plan=pathTo(terminal),minimum=deepPointCost(plan);
  if(!Number.isInteger(subjectPoints)||subjectPoints<minimum||!Number.isInteger(totalPoints)||subjectPoints>totalPoints)throw new Error('Invalid point budget');
  const shadow=createVersionedRun({stageId:'S01',squadIds:squad,captainId:owner,seed:101});
  const append=(id:string)=>{
    const reason=deepLock(shadow,id);if(reason)throw new Error(`Invalid planned node ${id}: ${reason}`);
    shadow.treeNodes=[...shadow.treeNodes!,id];shadow.choicesSpent+=deepNodeCost(id,shadow);
    if(DEEP_NODE_MAP[id].kind==='ultimate')shadow.evolvedCount++;
  };
  for(const id of plan)append(id);
  const ordinary=(id:CharacterId)=>deepTreesFor(id,shadow).flatMap(tree=>tree.nodes).filter(node=>node.kind!=='ultimate');
  while(deepPointCost(plan)<subjectPoints){
    const next=ordinary(owner).find(node=>!deepLock(shadow,node.id));
    if(!next)throw new Error(`Cannot fill ${owner} subject budget`);
    plan.push(next.id);append(next.id);
  }
  // Keep the same two support cores across subjects; fillers never inflate the subject budget.
  for(const support of ['C03','C05','C02'] as CharacterId[]){
    if(support===owner||!squad.includes(support))continue;
    const path=pathTo(CURRENT_TERMINALS.find(node=>node.ownerId===support)!.id);
    if(deepPointCost(plan)+deepPointCost(path)>totalPoints)continue;
    for(const id of path){plan.push(id);append(id);}
    if(shadow.evolvedCount===3)break;
  }
  while(deepPointCost(plan)<totalPoints){
    const next=squad.filter(id=>id!==owner).flatMap(ordinary).find(node=>!deepLock(shadow,node.id));
    if(!next)throw new Error('Cannot fill current point budget');
    plan.push(next.id);append(next.id);
  }
  if(deepPointCost(plan)!==totalPoints||deepPointCost(plan.filter(id=>DEEP_NODE_MAP[id].ownerId===owner))!==subjectPoints)throw new Error('Invalid current point policy');
  return {squad,owner,plan};
}

export interface DeepRunOptions {
  contentVersion?:string;
  compatibility?:Parameters<typeof createVersionedRun>[2];
}

function validatePlan(s:RunState,plan:readonly string[]){
  if(new Set(plan).size!==plan.length)throw new Error('Invalid policy: duplicate nodes');
  const shadow={...s,treeNodes:[...s.treeNodes!]};
  for(const id of plan){
    const reason=deepLock(shadow,id);if(reason)throw new Error(`Invalid policy ${id}: ${reason}`);
    shadow.treeNodes=[...shadow.treeNodes,id];
    if(DEEP_NODE_MAP[id].kind==='ultimate')shadow.evolvedCount++;
  }
  // A priority plan may include unused later nodes; the live offer enforces the operation cap.
}

/** Uses the current offer and legal-node query; a cleared wave may retain unspent points. */
export function allocateDeepPlan(s:RunState,plan:readonly string[]){
  if(!s.draft)throw new Error('Policy requires an allocation offer');
  const legal=deepLegalNodes(s),remaining=s.draft.pointTarget!-s.choicesSpent;
  const id=plan.find(id=>legal.includes(id)&&deepNodeCost(id,s)<=remaining);
  const action=id?{type:'buy-node' as const,offerId:s.draft.id,nodeId:id}
    :s.waveFlow?{type:'confirm-node' as const,offerId:s.draft.id,nodeIds:[]}:null;
  if(!action||!command(s,action))throw new Error(`Policy rejected ${id??'allocation completion'} at tick ${s.tick}, offer ${s.draft?.id}, remaining ${remaining}; legal: ${legal.join(',')}`);
}

export function playDeep(config:RunConfig,plan:string[],checkRestore=false,options:DeepRunOptions={}){
  let s=createRun(config,options.contentVersion,options.compatibility);let restored=false,bossDeadAt:number|null=null,bossSpawnedAt:number|null=null;
  validatePlan(s,plan);
  const profile=operationProfile(s),limit=s.waveFlow?(profile.waves.length+1)*600*30:Math.max(24000,Math.ceil((profile.bossAt+300)*30));
  for(let guard=0;guard<limit*2&&!s.outcome&&s.tick<limit;guard++){
    if(checkRestore&&!restored&&s.choicesSpent>=7){const before=JSON.stringify(s);s=restoreRun(s);if(JSON.stringify(s)!==before)throw new Error('Restore drift');restored=true;}
    if(s.bossIntro){if(!command(s,{type:'finish-boss-intro'}))throw new Error('Boss introduction command rejected');continue;}
    if(s.draft){allocateDeepPlan(s,plan);continue;}
    if(shouldAutoCast(s,true)&&!command(s,{type:'cast'}))throw new Error('Automatic tactical command rejected');
    const tick=s.tick;stepRun(s);if(s.tick===tick&&!s.outcome)throw new Error(`Policy stalled: ${s.pauseReasons.join(',')}`);
    if(s.bossSpawned&&bossSpawnedAt===null)bossSpawnedAt=s.tick;
    if(s.bossKilled&&bossDeadAt===null)bossDeadAt=s.tick;
  }
  if(!s.outcome)throw new Error(`Policy timed out at tick ${s.tick}, wave ${s.waveFlow?.wave??'timed'}`);
  return {s,restored,bossDeadAt,bossSpawnedAt};
}
export function replayDeep(recorded:RunState){
  const s=createRun(recorded.config,recorded.contentVersion,{experienceVersion:recorded.experienceVersion??null,operationVersion:recorded.operationVersion,legacyOperations:recorded.operationVersion===undefined,legacyCommonSkills:recorded.commanderSkillVersion!==1,legacyBalance:recorded.balanceVersion===undefined,balanceVersion:recorded.balanceVersion});let cursor=0;
  for(let guard=0;guard<=recorded.tick+recorded.actions.length;guard++){
    while(recorded.actions[cursor]?.tick===s.tick){
      const action=recorded.actions[cursor];
      if(!command(s,action.command))throw new Error(`Replay command rejected at action ${cursor}, tick ${s.tick}: ${JSON.stringify(action.command)}`);
      cursor++;
    }
    if(s.tick===recorded.tick)break;
    if(s.outcome)throw new Error(`Replay ended early at tick ${s.tick}`);
    if(s.pauseReasons.length)throw new Error(`Replay stalled at tick ${s.tick}: ${s.pauseReasons.join(',')}`);
    if(recorded.actions[cursor]&&recorded.actions[cursor].tick<s.tick)throw new Error(`Replay missed action ${cursor}`);
    stepRun(s);
  }
  if(cursor!==recorded.actions.length||s.tick!==recorded.tick||s.outcome!==recorded.outcome)throw new Error(`Replay incomplete: ${cursor}/${recorded.actions.length} actions, tick ${s.tick}/${recorded.tick}`);
  return s;
}
const DEEP_NODES=[...CHARACTER_TREES.flatMap(t=>t.nodes),...COMMON_TREE.nodes];
export const ALL_TERMINALS=DEEP_NODES.filter(n=>n.kind==='ultimate');

// Archived 0.4 rules remain replayable after the skill rework.
function createRun(config:Parameters<typeof createVersionedRun>[0],version=PRE_REWORK_VERSION,compatibility:Parameters<typeof createVersionedRun>[2]={}){return createVersionedRun(config,version,compatibility);}
