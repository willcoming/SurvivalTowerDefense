import { DEEP_NODE_MAP, DEEP_NODES, DEEP_TREE_MAP, usesFreeSkills, type DeepMods, type SkillOwner } from '../data/deep-trees';
import type { CharacterId, RunState } from './types';

const cache = new WeakMap<RunState,{nodes:string[]|undefined;mods:Map<SkillOwner,DeepMods>;team:DeepMods}>();
const MAX = new Set(['burstRadius','fieldRadius','executeThreshold','echoCount','salvoShots']);
const MIN = new Set(['exposureEvery','stunEvery','knockEvery','shieldInterval','salvoEvery','critEvery','burstEvery','missileEvery','teamMarkEvery']);
export function deepMods(s:RunState,owner:SkillOwner):DeepMods {
  if(!usesFreeSkills(s))return {};
  let c=cache.get(s);if(!c||c.nodes!==s.treeNodes){c={nodes:s.treeNodes,mods:new Map(),team:{}};cache.set(s,c);}
  const existing=c.mods.get(owner);if(existing)return existing;
  const result:DeepMods={};
  for(const id of s.treeNodes??[]){const node=DEEP_NODE_MAP[id];if(node?.ownerId!==owner)continue;
    for(const [key,value] of Object.entries(node.mods) as [keyof DeepMods,number][])result[key]=MAX.has(key)?Math.max(result[key]??0,value):MIN.has(key)?Math.min(result[key]??Infinity,value):(result[key]??0)+value;
  }
  c.mods.set(owner,result);return result;
}
export function teamMod(s:RunState,key:keyof DeepMods){
  if(!usesFreeSkills(s))return 0;const common=deepMods(s,'common'),c=cache.get(s)!;
  return c.team[key]??(c.team[key]=(common[key]??0)+s.config.squadIds.reduce((sum,id)=>sum+(deepMods(s,id)[key]??0),0));
}
export const deepHas = (s:RunState,id:string) => (s.treeNodes??[]).includes(id);
export const deepUltimate = (s:RunState,owner:CharacterId) => (s.treeNodes??[]).find(id=>DEEP_NODE_MAP[id]?.ownerId===owner&&DEEP_NODE_MAP[id].kind==='ultimate');
export function deepLock(s:RunState,id:string):string|null {
  const n=DEEP_NODE_MAP[id];if(!n)return '未知節點';
  if(n.ownerId!=='common'&&!s.config.squadIds.includes(n.ownerId))return '角色未出戰';
  if(deepHas(s,id))return '已取得';
  if(n.kind==='ultimate'){
    if(n.ownerId==='common')return '共用技能沒有終極';
    if(deepUltimate(s,n.ownerId))return '本角色已取得終極';
    if(s.evolvedCount>=s.evolutionLimit)return '全隊終極名額已滿';
  }
  const fulfilled=n.requires==='all'?n.parents.every(p=>deepHas(s,p)):!n.parents.length||n.parents.some(p=>deepHas(s,p));
  if(!fulfilled)return `先取得${n.parents.map(p=>DEEP_NODE_MAP[p].name).join(n.requires==='any'?' 或 ':'＋')}`;
  if(n.kind==='ultimate'&&(s.treeNodes??[]).filter(p=>DEEP_NODE_MAP[p]?.treeId===n.treeId).length<4)return '本樹先投入 4 點';
  return null;
}
export const deepLegalNodes=(s:RunState)=>DEEP_NODES.filter(n=>!deepLock(s,n.id)).map(n=>n.id);
export function syncDeepWeapon(s:RunState,id:CharacterId){
  const own=(s.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),ult=deepUltimate(s,id),w=s.weapons.find(w=>w.id===id)!;
  w.rank=ult?3:Math.min(2,own.length);w.branch=own.length?DEEP_TREE_MAP[DEEP_NODE_MAP[ult??own[0]].treeId].visualBranch:null;
}
export function validateDeepTree(s:RunState){
  if(!Array.isArray(s.treeNodes)||s.treeNodes.length>24||new Set(s.treeNodes).size!==s.treeNodes.length||Object.keys(s.commonRanks).length)throw new Error('自由技能樹紀錄損壞');
  const shadow={...s,treeNodes:[] as string[],evolvedCount:0};
  for(const id of s.treeNodes){if(deepLock(shadow,id))throw new Error('技能前置或終極互斥損壞');shadow.treeNodes=[...shadow.treeNodes,id];if(DEEP_NODE_MAP[id].kind==='ultimate')shadow.evolvedCount++;}
  if(shadow.evolvedCount!==s.evolvedCount||s.treeNodes.length!==s.choicesSpent||s.evolutionLimit!==(s.config.challengeId==='two-evolutions'?2:3)||s.choicesEarned!==Math.min(24,2*Math.floor(s.xp/60))||s.rerollsRemaining!==0)throw new Error('技能點計數損壞');
  if(s.stats.choices.length!==s.treeNodes.length||s.stats.choices.some((c,i)=>c.nodeId!==s.treeNodes![i]))throw new Error('技能選擇歷史損壞');
  if(s.draft&&(!Number.isInteger(s.draft.id)||s.draft.id<1||!s.config.squadIds.includes(s.draft.focusId)||s.draft.selectedEvolution!==null||s.draft.customNodeId!==undefined||s.draft.cards.length||s.draft.choice!==Math.floor(s.choicesSpent/2)+1||s.draft.pointTarget!==Math.min(s.choicesEarned,(Math.floor(s.choicesSpent/2)+1)*2)||!s.pauseReasons.includes('upgrade')||s.choicesSpent>=s.choicesEarned))throw new Error('選點里程碑紀錄損壞');
  if(!s.draft&&s.pauseReasons.includes('upgrade'))throw new Error('缺少技能選點紀錄');
  if(!s.support||Object.values(s.support).some(n=>!Number.isFinite(n)||n<0)||!Array.isArray(s.wavePlan)||s.wavePlan.length!==8)throw new Error('戰場事件或共用技能紀錄損壞');
  for(const w of s.weapons){const view={...s,weapons:s.weapons.map(w=>({...w}))};syncDeepWeapon(view,w.id);const v=view.weapons.find(x=>x.id===w.id)!;if(v.rank!==w.rank||v.branch!==w.branch)throw new Error('武器技能外觀紀錄損壞');}
}
