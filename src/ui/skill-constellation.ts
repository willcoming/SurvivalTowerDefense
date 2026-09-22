import { NETWORK_WIDTH, NETWORK_HEIGHT } from '../data/skill-network';
import { resolveSkillTree } from '../data/reworked-skills';
import type { FormId } from '../sim/types';
import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, deepTreesFor, type DeepNode, type DeepTree } from '../data/deep-trees';
import { deepHas, deepLock, deepNodeCost, deepPointCost } from '../sim/deep-tree';
import type { RunState } from '../sim/types';
import { esc } from './format';

/** Small, consistent line emblems remain readable in a 44px touch target. */
export function skillEmblem(node: DeepNode) {
  const m = node.mods;
  const path = node.kind === 'ultimate'
    ? '<path d="m16 3 3.5 8.5L29 16l-9.5 4.5L16 29l-3.5-8.5L3 16l9.5-4.5Z"/><path d="m16 10 2 6-2 6-2-6Z"/>'
    : m.shield || m.autoShield || m.shieldCapacity || m.skillShield || m.wallReduction
    ? '<path d="m16 4 10 4v8c0 6-10 12-10 12S6 22 6 16V8Z"/><path d="M16 10v12m-6-6h12"/>'
    : m.haste || m.skillCooldown || m.cooling || m.ventHaste
    ? '<path d="m19 3-13 16h9l-2 10 13-17h-9Z"/>'
    : m.range || m.critEvery || m.teamMarkEvery || m.mainDamage
    ? '<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="3"/><path d="M16 2v6m0 16v6M2 16h6m16 0h6"/>'
    : m.burn || m.fireDamage || m.heatBonus
    ? '<path d="M18 3c2 9 10 10 7 18-3 9-18 8-19-1-1-5 4-10 7-12-1 6 3 7 4 5Z"/><path d="M16 18c-5 5-3 9 1 9s6-5-1-9Z"/>'
    : m.targets || m.dronePower || m.missiles || m.chainReturn || m.chainBurst
    ? '<circle cx="16" cy="16" r="4"/><circle cx="6" cy="6" r="3"/><circle cx="26" cy="6" r="3"/><circle cx="16" cy="27" r="3"/><path d="m8 8 5 5m6 0 5-5m-8 12v4"/>'
    : m.radius || m.pull || m.knockback || m.fieldExposure
    ? '<circle cx="16" cy="16" r="4"/><path d="M16 3v6m0 14v6M3 16h6m14 0h6M7 7l4 4m10 10 4 4M7 25l4-4m10-10 4-4"/>'
    : '<path d="m9 25 15-18 2-4-5 2L6 23Zm9-15 4 3M5 19l8 7M5 28l4-5"/>';
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function constellationGraph(tree: DeepTree, run?: RunState, selected?: string | null, action = run ? 'deep-node' : 'codex-node', form?: FormId) {
  const trees = deepTreesFor(tree.ownerId,run).map(t=>resolveSkillTree(t,tree.ownerId==='common'?undefined:run?.config.forms?.[tree.ownerId]??form)), pending = run?.draft?.pendingNodeIds ?? [];
  const shadow = run ? { ...run, treeNodes: [...(run.treeNodes ?? []), ...pending], evolvedCount: run.evolvedCount + pending.filter(id => DEEP_NODE_MAP[id]?.kind === 'ultimate').length } : undefined;
  if(trees.some(t=>t.nodes.some(n=>n.atlas)))return networkGraph(trees,tree.id,run,selected,action,shadow);
  const ancestors = new Set<string>();
  const trace = (id: string) => { if (ancestors.has(id)) return; ancestors.add(id); DEEP_NODE_MAP[id]?.parents.forEach(trace); };
  if (selected) trace(selected);
  const point = (node: DeepNode) => {
    const index = trees.findIndex(t => t.id === node.treeId);
    const angle = (trees.length === 1 ? -90 : trees.length === 2 ? -137 + index * 94 : -150 + index * 60) + (node.lane - 1) * 17;
    const radius = 132 + node.layer * 94;
    return { x: 600 + Math.cos(angle * Math.PI / 180) * radius, y: 574 + Math.sin(angle * Math.PI / 180) * radius };
  };
  const mobilePoint = (node: DeepNode) => ({ x: 60 + node.lane * 120, y: 58 + node.layer * 108 });
  const edges = (mobile: boolean) => trees.flatMap(t => t.nodes.flatMap(node => node.parents.map(id => {
    const parent = DEEP_NODE_MAP[id], a = mobile ? mobilePoint(parent) : point(parent), b = mobile ? mobilePoint(node) : point(node);
    const connected = !!run && deepHas(run, id) && deepHas(run, node.id);
    const queued = pending.includes(node.id) && (!!run && deepHas(run, id) || pending.includes(id));
    return `<path class="${connected ? 'connected' : ''} ${queued ? 'queued' : ''} ${ancestors.has(id) && ancestors.has(node.id) ? 'traced' : ''} ${t.id === tree.id ? 'active-route' : ''}" data-tree="${t.id}" data-parent="${id}" data-child="${node.id}" d="M ${a.x} ${a.y} L ${a.x} ${(a.y + b.y) / 2} L ${b.x} ${b.y}"/>`;
  }))).join('');
  const name = tree.ownerId === 'common' ? '全隊共用' : CHARACTER_MAP[tree.ownerId].name;
  return `<div class="deep-graph constellation-map" data-active-tree="${tree.id}" style="--mobile-map-height:${(Math.max(...tree.nodes.map(n => n.layer)) + 1) * 108 + 20}px" aria-label="${esc(name)}完整技能路線圖">
    <svg class="constellation-grid" viewBox="0 0 1200 660" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="600" cy="574" r="132"/><circle cx="600" cy="574" r="320"/><circle cx="600" cy="574" r="508"/><path d="M20 574H1180M600 20V640M140 115l920 460M1060 115 140 575M230 70l740 570M970 70 230 640"/></g></svg>
    <svg class="deep-connections constellation-desktop-edges" viewBox="0 0 1200 660" aria-hidden="true">${trees.map(t => { const p = point(t.nodes[0]); return `<path class="root-link ${run && deepHas(run, t.nodes[0].id) ? 'connected' : pending.includes(t.nodes[0].id) ? 'queued' : ''} ${t.id === tree.id ? 'active-route' : ''}" d="M600 574 L${p.x} ${p.y}"/>`; }).join('')}${edges(false)}</svg>
    <svg class="deep-connections constellation-mobile-edges" viewBox="0 0 360 ${(Math.max(...tree.nodes.map(n => n.layer)) + 1) * 108 + 20}" preserveAspectRatio="none" aria-hidden="true">${edges(true)}</svg>
    <div class="constellation-core" aria-hidden="true"><span>✧</span><small>${esc(name)}</small></div>
    ${trees.map((t, index) => `<div class="constellation-branch ${t.id === tree.id ? 'active' : ''}" style="--branch-x:${trees.length === 1 ? 50 : trees.length === 2 ? 20 + index * 60 : 16 + index * 34}%"><small>0${index + 1} / ${t.nodes.length} NODES</small><strong>${esc(t.name)}</strong></div>`).join('')}
    ${trees.flatMap(t => t.nodes.map(node => {
      const p = point(node), mp = mobilePoint(node), owned = !!run && deepHas(run, node.id), queued = pending.includes(node.id), cost = deepNodeCost(node.id, run);
      const reason = run && !owned && !queued ? deepLock(shadow!, node.id) ?? (run.draft && cost > (run.draft.pointTarget ?? 0) - run.choicesSpent - deepPointCost(pending, run) ? `需要 ${cost} 點，剩餘點數不足` : null) : null;
      const state = owned ? 'owned' : queued ? 'pending' : reason ? 'locked' : run ? 'available' : 'preview';
      const status = owned ? '已取得' : queued ? '待確認' : reason ?? (run ? `${cost} 點可取得` : `預覽 · ${cost} 點`);
      return `<button class="deep-node constellation-node ${state} ${node.kind} ${selected === node.id ? 'inspecting' : ''} ${t.id === tree.id ? 'active-branch' : ''}" style="--node-x:${p.x / 12}%;--node-y:${p.y / 6.6}%;--mobile-x:${mp.x / 3.6}%;--mobile-y:${mp.y}px" data-action="${action}" data-id="${node.id}" data-state="${state}" data-cost="${cost}" data-layer="${node.layer}" aria-pressed="${selected === node.id}" aria-label="${esc(node.name)}，${esc(status)}"><span class="node-symbol">${skillEmblem(node)}</span><strong>${esc(node.name)}</strong><small>${owned ? '✓' : queued ? '●' : node.kind === 'ultimate' ? `${cost} 點` : ''}</small></button>`;
    })).join('')}
    <div class="constellation-caption">${run ? 'SKILL CONSTELLATION' : 'SKILL ARCHIVE'}<span>${run ? '選擇節點 · 配置你的戰鬥風格' : '技能預覽 · 於每局戰鬥中配置'}</span></div>
  </div>`;
}

/** One world coordinate system for the map, connectors and all input methods. */
function networkGraph(trees:DeepTree[],activeTree:string,run:RunState|undefined,selected:string|null|undefined,action:string,shadow:RunState|undefined){
 const nodes=trees.flatMap(t=>t.nodes),owner=trees[0].ownerId,name=owner==='common'?'全隊共用':CHARACTER_MAP[owner].name,pending=run?.draft?.pendingNodeIds??[];
 const ancestors=new Set<string>();const trace=(id:string)=>{if(ancestors.has(id))return;ancestors.add(id);DEEP_NODE_MAP[id]?.parents.forEach(trace);};if(selected)trace(selected);
 const edge=(child:DeepNode,parent?:DeepNode)=>{
  const a=parent?.atlas??{x:620,y:585},b=child.atlas!,owned=!!run&&deepHas(run,child.id)&&(!parent||deepHas(run,parent.id)),queued=pending.includes(child.id)&&(!parent||pending.includes(parent.id)||!!run&&deepHas(run,parent.id));
  return `<path class="${owned?'connected':''} ${queued?'queued':''} ${ancestors.has(child.id)&&(!parent||ancestors.has(parent.id))?'traced':''} ${parent&&parent.treeId!==child.treeId?'cross-route':''}" data-parent="${parent?.id??'core'}" data-child="${child.id}" d="M ${a.x} ${a.y-29} L ${a.x} ${a.y-47} L ${b.x} ${b.y+47} L ${b.x} ${b.y+29}"/>`;
 };
 return `<div class="deep-graph constellation-map skill-network" data-map-key="${run?.runId??'preview'}:${owner}" data-active-tree="${activeTree}" data-selected="${selected??''}" data-world-width="${NETWORK_WIDTH}" data-world-height="${NETWORK_HEIGHT}" aria-label="${esc(name)}完整技能路線圖">
 <svg class="network-grid" viewBox="0 0 ${NETWORK_WIDTH} ${NETWORK_HEIGHT}" aria-hidden="true"><defs><pattern id="network-grid-${owner}" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="currentColor" stroke-width=".6"/></pattern></defs><path d="M620 585L90 100H1150Z" fill="none" stroke="currentColor"/><rect width="100%" height="100%" fill="url(#network-grid-${owner})"/></svg>
 <svg class="deep-connections network-edges" viewBox="0 0 ${NETWORK_WIDTH} ${NETWORK_HEIGHT}" aria-hidden="true">${nodes.flatMap(n=>n.parents.length?n.parents.map(id=>edge(n,DEEP_NODE_MAP[id])):[edge(n)]).join('')}</svg>
 <div class="network-core" style="left:620px;top:585px" aria-hidden="true"><span>✧</span><b>${esc(name)}</b><small>角色核心</small></div>
 ${trees.map((t,i)=>`<div class="network-discipline" style="left:${[260,620,985][i]}px"><small>0${i+1}</small><strong>${esc(t.name)}</strong></div>`).join('')}
 ${nodes.sort((a,b)=>a.layer-b.layer||a.atlas!.x-b.atlas!.x).map(node=>{
  const owned=!!run&&deepHas(run,node.id),queued=pending.includes(node.id),cost=deepNodeCost(node.id,run);
  const reason=run&&!owned&&!queued?deepLock(shadow!,node.id)??(run.draft&&cost>(run.draft.pointTarget??0)-run.choicesSpent-deepPointCost(pending,run)?`需要 ${cost} 點，剩餘點數不足`:null):null;
  const state=owned?'owned':queued?'pending':reason?'locked':run?'available':'preview',status=owned?'已取得':queued?'待確認':reason??`${cost} 點${run?'可取得':'預覽'}`;
  const capstone=!nodes.some(n=>n.parents.includes(node.id))&&node.kind!=='ultimate';
  return `<button class="deep-node constellation-node ${state} ${node.kind} ${capstone?'capstone':''} ${selected===node.id?'inspecting':''} ${node.treeId===activeTree?'active-branch':''}" style="--node-x:${node.atlas!.x}px;--node-y:${node.atlas!.y}px" data-action="${action}" data-id="${node.id}" data-tree="${node.treeId}" data-state="${state}" data-cost="${cost}" data-layer="${node.layer}" data-x="${node.atlas!.x}" data-y="${node.atlas!.y}" aria-pressed="${selected===node.id}" aria-label="${esc(node.name)}，${esc(status)}${node.parents.length>1?'，任一前置即可':''}"><span class="node-symbol">${skillEmblem(node)}</span><strong>${esc(node.name)}</strong><small>${owned?'✓':queued?'●':node.kind==='ultimate'?'終極 · 2':capstone?'封頂':node.parents.length>1?'匯合':''}</small></button>`;
 }).join('')}
 </div>`;
}
