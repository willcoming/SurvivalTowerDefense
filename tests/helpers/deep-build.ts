import { DEEP_NODE_MAP, DEEP_NODES, CHARACTER_TREES } from '../../src/data/deep-trees';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { deepLegalNodes } from '../../src/sim/deep-tree';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import type { CharacterId, RunConfig, RunState } from '../../src/sim/types';

export function pathTo(id:string):string[]{
  const n=DEEP_NODE_MAP[id];if(!n)throw new Error(`Unknown node ${id}`);
  const parents=n.requires==='any'?n.parents.slice(0,1):n.parents;
  return [...new Set([...parents.flatMap(pathTo),id])];
}
export function buildPlan(terminal:string,budget=5){
  const owner=DEEP_NODE_MAP[terminal].ownerId as CharacterId;
  const squad=[owner,...(['C03','C05','C02','C06','C04','C01'] as CharacterId[]).filter(id=>id!==owner)].slice(0,5);
  const others=['C03-B/8','C05-B/7','C02-A/9'].filter(id=>DEEP_NODE_MAP[id].ownerId!==owner&&squad.includes(DEEP_NODE_MAP[id].ownerId as CharacterId)).slice(0,2);
  const paths=[pathTo(terminal),...others.map(pathTo)],plan:string[]=[];
  for(let i=0;i<5;i++)for(const p of paths)plan.push(p[i]);
  if(budget===7){const other=CHARACTER_TREES.find(t=>t.ownerId===owner&&t.id!==DEEP_NODE_MAP[terminal].treeId)!;plan.push(other.nodes[0].id,other.nodes[1].id);}
  for(const id of ['TEAM/0','TEAM/1','TEAM/2','TEAM/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11'])if(plan.length<24)plan.push(id);
  for(const id of squad.filter(id=>!paths.some(p=>DEEP_NODE_MAP[p[0]].ownerId===id)))for(const n of CHARACTER_TREES.find(t=>t.ownerId===id)!.nodes.filter(n=>n.kind!=='ultimate'))if(plan.length<24)plan.push(n.id);
  if(plan.length!==24||new Set(plan).size!==24)throw new Error('Invalid 24-point policy');
  return {squad,owner,plan};
}
export function playDeep(config:RunConfig,plan:string[],checkRestore=false){
  let s=createRun(config);let restored=false,bossDeadAt:number|null=null;
  for(let guard=0;guard<17000&&!s.outcome;guard++){
    if(s.draft){const id=plan[s.choicesSpent];if(!id||!command(s,{type:'buy-node',offerId:s.draft.id,nodeId:id}))throw new Error(`Policy rejected ${id}: ${deepLegalNodes(s)}`);
      if(checkRestore&&s.choicesSpent===7){const before=JSON.stringify(s);s=restoreRun(s);if(JSON.stringify(s)!==before)throw new Error('Restore drift');restored=true;}continue;}
    if(s.bossIntro){command(s,{type:'finish-boss-intro'});continue;}
    if(shouldAutoCast(s,true))command(s,{type:'cast'});stepRun(s);if(s.bossKilled&&bossDeadAt===null)bossDeadAt=s.tick;
  }
  return {s,restored,bossDeadAt};
}
export function replayDeep(recorded:RunState){
  const s=createRun(recorded.config);let cursor=0;
  for(let guard=0;guard<17000&&!s.outcome;guard++){
    while(recorded.actions[cursor]?.tick===s.tick)if(!command(s,recorded.actions[cursor++].command))throw new Error('Replay command rejected');
    if(s.outcome)break;if(s.pauseReasons.length)throw new Error('Replay stalled');stepRun(s);
  }
  return s;
}
export const ALL_TERMINALS=DEEP_NODES.filter(n=>n.kind==='ultimate');
