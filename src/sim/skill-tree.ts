import { usesFreeSkills } from '../data/deep-trees';
import { deepMods, deepUltimate, deepLock, deepLegalNodes, syncDeepWeapon, validateDeepTree } from './deep-tree';
import { COMMON_UPGRADES } from '../data/content';
import { NODE_MAP, SKILL_NODES, TREE_MAP, usesSkillTrees, type TreeMods } from '../data/skill-trees';
import type { CharacterId, RunState } from './types';

const modifierCache = new WeakMap<RunState, { nodes: string[] | undefined; byId: Map<CharacterId, TreeMods> }>();
export function treeMods(s: RunState, id: CharacterId): TreeMods {
  if(usesFreeSkills(s))return deepMods(s,id);
  if (!usesSkillTrees(s)) return {};
  let cached = modifierCache.get(s);
  if (!cached || cached.nodes !== s.treeNodes) { cached = { nodes: s.treeNodes, byId: new Map() }; modifierCache.set(s, cached); }
  const hit = cached.byId.get(id); if (hit) return hit;
  const result: TreeMods = {};
  for (const nodeId of s.treeNodes ?? []) {
    const node = NODE_MAP[nodeId]; if (node?.ownerId !== id) continue;
    for (const [key, value] of Object.entries(node.mods) as [keyof TreeMods, number][]) {
      result[key] = ['burstRadius','fieldRadius'].includes(key) ? Math.max(result[key]??0,value) : ['exposureEvery','stunEvery','knockEvery','shieldInterval'].includes(key) ? Math.min(result[key] ?? Infinity, value) : (result[key] ?? 0) + value;
    }
  }
  cached.byId.set(id, result); return result;
}
export const hasNode = (s: RunState, id: string) => (s.treeNodes ?? []).includes(id);
export const ultimateFor = (s: RunState, id: CharacterId) => usesFreeSkills(s) ? deepUltimate(s,id) : (s.treeNodes ?? []).find(n => NODE_MAP[n]?.ownerId === id && NODE_MAP[n].kind === 'ultimate');
export function nodeLock(s: RunState, nodeId: string): string | null {
  if(usesFreeSkills(s))return deepLock(s,nodeId);
  const n = NODE_MAP[nodeId];
  if (!n || !s.config.squadIds.includes(n.ownerId)) return '角色未出戰';
  if (hasNode(s, nodeId)) return '已取得';
  if (n.kind === 'entry') return null;
  if (n.kind === 'ultimate') {
    if (ultimateFor(s,n.ownerId)) return '本角色已選擇其他終極';
    if (s.evolvedCount >= s.evolutionLimit) return '全隊終極名額已滿';
  }
  if (!hasNode(s,`${n.treeId}:0`)) return '先取得入口';
  if (n.kind === 'ultimate' && (s.treeNodes ?? []).filter(id => NODE_MAP[id]?.treeId === n.treeId && NODE_MAP[id].kind !== 'ultimate').length < 3) return '需要入口＋任兩個分支';
  return null;
}
export function treeLegalNodes(s: RunState): string[] {
  if(usesFreeSkills(s))return deepLegalNodes(s);
  const result = SKILL_NODES.filter(n => !nodeLock(s,n.id)).map(n => n.id);
  for (const g of COMMON_UPGRADES) {
    const ids = s.config.squadIds;
    if(g.id==='G04'&&s.config.challengeId==='no-skill')continue;
    if (g.id === 'G03' && !ids.some(id => ['C04','C05'].includes(id) || (treeMods(s,id).burstDamage ?? 0)>0) && (s.config.challengeId==='no-skill'||!['C01','C05'].includes(s.config.captainId))) continue;
    if (g.id === 'G06' && !ids.some(id => ['C04','C05','C06'].includes(id) || (treeMods(s,id).exposureValue ?? 0)>0 || (treeMods(s,id).stunSeconds ?? 0)>0) && (s.config.challengeId==='no-skill'||!['C02','C04','C05'].includes(s.config.captainId))) continue;
    const rank = s.commonRanks[g.id] ?? 0; if (rank < g.max) result.push(`${g.id}-${rank+1}`);
  }
  return result.sort();
}
/** Rank/branch are a presentation adapter only; new combat uses the complete node set. */
export function syncTreeWeapon(s: RunState, id: CharacterId) {
  if(usesFreeSkills(s))return syncDeepWeapon(s,id);
  const w = s.weapons.find(w => w.id === id)!;
  const own = (s.treeNodes ?? []).filter(n => NODE_MAP[n]?.ownerId === id);
  const ultimate = ultimateFor(s,id);
  w.rank = ultimate ? 3 : Math.min(2,own.length);
  w.branch = own.length ? TREE_MAP[NODE_MAP[ultimate ?? own[0]].treeId].visualBranch : null;
}
export function validateTreeState(s: RunState) {
  if(usesFreeSkills(s))return validateDeepTree(s);
  if (!Array.isArray(s.treeNodes) || new Set(s.treeNodes).size !== s.treeNodes.length || s.treeNodes.length > 18) throw new Error('技能樹紀錄損壞');
  const shadow = { ...s, treeNodes: [] as string[], commonRanks: {}, evolvedCount: 0 };
  for (const id of s.treeNodes) {
    if (!NODE_MAP[id] || nodeLock(shadow,id)) throw new Error('技能樹前置或終極紀錄損壞');
    shadow.treeNodes = [...shadow.treeNodes,id]; if (NODE_MAP[id].kind === 'ultimate') shadow.evolvedCount++;
  }
  if (shadow.evolvedCount !== s.evolvedCount || s.evolutionLimit !== (s.config.challengeId === 'two-evolutions' ? 2 : 3) || s.treeNodes.length + Object.values(s.commonRanks).reduce((a,b)=>a+b,0) + s.stats.choices.filter(c=>c.nodeId==='EMPTY').length !== s.choicesSpent) throw new Error('技能樹配點計數損壞');
  for (const w of s.weapons) {
    const view = { ...s, weapons: s.weapons.map(x => ({...x})) }; syncTreeWeapon(view,w.id);
    const expected = view.weapons.find(x=>x.id===w.id)!;
    if (w.rank!==expected.rank || w.branch!==expected.branch) throw new Error('技能樹武器狀態損壞');
  }
}
