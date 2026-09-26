import {describe,it,expect} from 'vitest';
import {CHARACTER_IDS} from '../../src/data/content';
import {deepTreesFor,DEEP_NODE_MAP,type DeepNode} from '../../src/data/deep-trees';
import {LINEAR_SKILL_VERSION,resolveSkillTree} from '../../src/data/reworked-skills';
import {NETWORK_WIDTH,NETWORK_HEIGHT} from '../../src/data/skill-network';
import {createRun,command,restoreRun,stepRun} from '../../src/sim/engine';
import {openDraft} from '../../src/sim/draft';
import {deepLock,deepLegalNodes,deepNodeCost,deepPointCost} from '../../src/sim/deep-tree';
import type {CharacterId,RunState} from '../../src/sim/types';
const routes=(n:DeepNode):string[][]=>n.parents.length?n.parents.flatMap(p=>routes(DEEP_NODE_MAP[p]).map(path=>[...path,n.id])):[[n.id]];
function funded(owner:CharacterId,points=6,version?:string){const s=createRun({stageId:'S12',squadIds:[owner],captainId:owner,seed:307},version??'0.6.0-dev.2');s.xp=points*30;s.choicesEarned=points;openDraft(s);return s;}
function buy(s:RunState,id:string){expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id}),id).toBe(true);}
function bankLastPoint(){const s=funded('C01',24);while(s.choicesSpent<22)buy(s,deepLegalNodes(s).find(id=>DEEP_NODE_MAP[id].kind!=='ultimate')!);const last=deepLegalNodes(s).find(id=>DEEP_NODE_MAP[id].kind!=='ultimate')!;expect(command(s,{type:'confirm-node',offerId:s.draft!.id,nodeIds:[last]})).toBe(true);return s;}
describe('branching skill network',()=>{
 it('has eight unique acyclic layouts, visible forks, cross-route merges and ordinary leaves',()=>{
  const signatures=new Set<string>();
  for(const id of CHARACTER_IDS){const nodes=deepTreesFor(id).flatMap(t=>t.nodes),ids=new Set(nodes.map(n=>n.id));expect(ids.size).toBe(24);
   const topology=nodes.map(n=>[n.id.slice(4),n.parents.map(p=>p.slice(4))]);signatures.add(JSON.stringify(topology));
   expect(nodes.filter(n=>n.parents.length===0)).toHaveLength(3);
   expect(nodes.some(n=>n.parents.some(p=>DEEP_NODE_MAP[p].treeId!==n.treeId))).toBe(true);
   expect(nodes.filter(n=>n.kind!=='ultimate'&&!nodes.some(child=>child.parents.includes(n.id))).length).toBeGreaterThanOrEqual(4);
   for(const n of nodes){expect(n.requires).toBe('any');expect(n.atlas!.x).toBeGreaterThan(60);expect(n.atlas!.x).toBeLessThan(NETWORK_WIDTH-60);expect(n.atlas!.y).toBeGreaterThan(80);expect(n.atlas!.y).toBeLessThan(NETWORK_HEIGHT-60);
    for(const p of n.parents){expect(ids.has(p)).toBe(true);expect(DEEP_NODE_MAP[p].layer).toBeLessThan(n.layer);expect(DEEP_NODE_MAP[p].atlas!.y).toBeGreaterThan(n.atlas!.y);}
   }
  }
  expect(signatures.size).toBe(8);
 });
 for(const id of CHARACTER_IDS)it(`${id}: every incoming route works alone; every ultimate route costs exactly six`,()=>{
  for(const n of deepTreesFor(id).flatMap(t=>t.nodes))for(const path of routes(n)){
   const s=funded(id);for(const p of path)buy(s,p);
   expect(s.treeNodes).toEqual(path);expect(s.choicesSpent).toBe(deepPointCost(path));
   if(n.kind==='ultimate'){expect(path).toHaveLength(5);expect(s.choicesSpent).toBe(6);expect(restoreRun(s)).toEqual(s);}
  }
 });
 it('keeps form topology and cost identical while replacing three ordinary skills and the ultimate',()=>{
  for(const owner of CHARACTER_IDS)for(const tree of deepTreesFor(owner)){
   const summer=resolveSkillTree(tree,`${owner}-summer`);
   expect(summer.nodes.map(n=>[n.id,n.parents,n.atlas,deepNodeCost(n.id)])).toEqual(tree.nodes.map(n=>[n.id,n.parents,n.atlas,deepNodeCost(n.id)]));
  }
 });
 it('banks one unspendable point, restores it and buys the ultimate at the next milestone',()=>{
  const s=bankLastPoint();expect(s.choicesSpent).toBe(23);expect(s.draft).toBeNull();expect(s.phase).toBe('running');expect(s.pauseReasons).not.toContain('upgrade');expect(restoreRun(s)).toEqual(s);
  s.xp=780;s.choicesEarned=26;openDraft(s);expect(s.draft!.pointTarget).toBe(25);expect(restoreRun(s)).toEqual(s);
  buy(s,deepLegalNodes(s)[0]);expect(s.choicesSpent).toBe(25);expect(s.treeNodes).toHaveLength(24);expect(s.draft).toBeNull();expect(restoreRun(s)).toEqual(s);
 });
 it('does not block victory when the final point cannot buy the remaining ultimate',()=>{
  const s=bankLastPoint();s.enemies=[];s.bossKilled=true;s.bossSpawned=true;s.spawnCursor=s.spawnPlan.length;stepRun(s);expect(s.outcome).toBe('victory');
 });
 it('preserves the prior linear snapshot and rejects mixing node generations',()=>{
  const old=funded('C01',6,LINEAR_SKILL_VERSION),current=funded('C01');
  for(const n of deepTreesFor('C01',old)[0].nodes)buy(old,n.id);
  expect(old.choicesSpent).toBe(6);expect(restoreRun(old)).toEqual(old);expect(deepLock(old,'C01-A3/0')).toBe('未知節點');expect(deepLock(current,'C01-A2/0')).toBe('未知節點');
 });
});
