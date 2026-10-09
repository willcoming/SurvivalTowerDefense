import { SKILL_NODE_SIZE, SKILL_ULTIMATE_SIZE, skillNetworkLayout } from './skill-network-layout';
import { resolveSkillTree } from '../data/reworked-skills';
import type { FormId } from '../sim/types';
import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, deepTreesFor, type DeepNode, type DeepTree } from '../data/deep-trees';
import { deepHas, deepLock, deepNodeCost } from '../sim/deep-tree';
import type { RunState } from '../sim/types';
import { esc } from './format';
import { skillEmblem } from './skill-emblems';
import { skillTheme } from './skill-theme';
export { skillEmblem } from './skill-emblems';

const ultimateOrbits = '<span class="ultimate-orbits" aria-hidden="true"><i></i><i></i></span>';

export function constellationGraph(tree: DeepTree, run?: RunState, selected?: string | null, action = run ? 'deep-node' : 'codex-node', form?: FormId) {
  const resolvedForm = tree.ownerId === 'common' ? undefined : run?.config.forms?.[tree.ownerId] ?? form;
  const trees = deepTreesFor(tree.ownerId,run).map(t=>resolveSkillTree(t,resolvedForm)), pending = run?.draft?.pendingNodeIds ?? [];
  if(trees.some(t=>t.nodes.some(n=>n.atlas)))return networkGraph(trees,tree.id,run,selected,action,resolvedForm);
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
  return `<div class="deep-graph constellation-map" data-active-tree="${tree.id}" style="${skillTheme(resolvedForm,tree.ownerId)};--mobile-map-height:${(Math.max(...tree.nodes.map(n => n.layer)) + 1) * 108 + 20}px" aria-label="${esc(name)}完整技能路線圖">
    <svg class="constellation-grid" viewBox="0 0 1200 660" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="600" cy="574" r="132"/><circle cx="600" cy="574" r="320"/><circle cx="600" cy="574" r="508"/><path d="M20 574H1180M600 20V640M140 115l920 460M1060 115 140 575M230 70l740 570M970 70 230 640"/></g></svg>
    <svg class="deep-connections constellation-desktop-edges" viewBox="0 0 1200 660" aria-hidden="true">${trees.map(t => { const p = point(t.nodes[0]); return `<path class="root-link ${run && deepHas(run, t.nodes[0].id) ? 'connected' : pending.includes(t.nodes[0].id) ? 'queued' : ''} ${t.id === tree.id ? 'active-route' : ''}" d="M600 574 L${p.x} ${p.y}"/>`; }).join('')}${edges(false)}</svg>
    <svg class="deep-connections constellation-mobile-edges" viewBox="0 0 360 ${(Math.max(...tree.nodes.map(n => n.layer)) + 1) * 108 + 20}" preserveAspectRatio="none" aria-hidden="true">${edges(true)}</svg>
    <div class="constellation-core" aria-hidden="true"><span>✧</span><small>${esc(name)}</small></div>
    ${trees.map((t, index) => `<div class="constellation-branch ${t.id === tree.id ? 'active' : ''}" style="--branch-x:${trees.length === 1 ? 50 : trees.length === 2 ? 20 + index * 60 : 16 + index * 34}%"><small>0${index + 1} / ${t.nodes.length} NODES</small><strong>${esc(t.name)}</strong></div>`).join('')}
    ${trees.flatMap(t => t.nodes.map(node => {
      const p = point(node), mp = mobilePoint(node), owned = !!run && deepHas(run, node.id), queued = pending.includes(node.id), cost = deepNodeCost(node.id, run);
      const reason = run && !owned && !queued ? deepLock(run, node.id) ?? (run.draft && cost > (run.draft.pointTarget ?? 0) - run.choicesSpent ? `需要 ${cost} 點，剩餘點數不足` : null) : null;
      const state = owned ? 'owned' : queued ? 'pending' : reason ? 'locked' : run ? 'available' : 'preview';
      const status = owned ? '已取得' : queued ? '待確認' : reason ?? (run ? `${cost} 點可取得` : `預覽 · ${cost} 點`);
      return `<button class="deep-node constellation-node ${state} ${node.kind} ${selected === node.id ? 'inspecting' : ''} ${t.id === tree.id ? 'active-branch' : ''}" style="--node-x:${p.x / 12}%;--node-y:${p.y / 6.6}%;--mobile-x:${mp.x / 3.6}%;--mobile-y:${mp.y}px" data-action="${action}" data-id="${node.id}" data-state="${state}" data-cost="${cost}" data-layer="${node.layer}" aria-pressed="${selected === node.id}" aria-label="${esc(node.name)}，${esc(status)}">${node.kind === 'ultimate' ? ultimateOrbits : ''}<span class="node-symbol">${skillEmblem(node,resolvedForm)}</span><strong>${esc(node.name)}</strong><small>${owned ? '✓' : queued ? '+1' : node.kind === 'ultimate' ? `${cost} 點` : ''}</small></button>`;
    })).join('')}
    <div class="constellation-caption">${run ? 'SKILL CONSTELLATION' : 'SKILL ARCHIVE'}<span>${run ? '選擇節點 · 配置你的戰鬥風格' : '技能預覽 · 於每局戰鬥中配置'}</span></div>
  </div>`;
}

/** One world coordinate system for the map, connectors and all input methods. */
function networkGraph(trees: DeepTree[], activeTree: string, run: RunState | undefined, selected: string | null | undefined, action: string, form?: FormId) {
  const nodes = trees.flatMap(tree => tree.nodes), owner = trees[0].ownerId;
  const name = owner === 'common' ? '全隊共用' : CHARACTER_MAP[owner].name;
  const pending = run?.draft?.pendingNodeIds ?? [], layout = skillNetworkLayout(nodes);
  const edge = (route: typeof layout.edges[number]) => {
    const parentOwned = !!run && route.parent !== 'core' && deepHas(run, route.parent);
    const owned = !!run && deepHas(run, route.child) && (route.parent === 'core' || parentOwned);
    const queued = pending.includes(route.child) && (route.parent === 'core' || pending.includes(route.parent) || parentOwned);
    const routeTree = nodes.find(node => node.id === route.child)!.treeId;
    return `<g class="network-route"><path class="route-underlay" d="${route.path}"/><path class="${owned ? 'connected' : ''} ${parentOwned ? 'outgoing-owned' : ''} ${queued ? 'queued' : ''} ${route.cross ? 'cross-route' : ''}" data-tree="${routeTree}" data-parent="${route.parent}" data-child="${route.child}" d="${route.path}"/>${owned || parentOwned ? `<path class="route-flow" d="${route.path}"/>` : ''}</g>`;
  };
  return `<div class="deep-graph constellation-map skill-network" data-map-key="${run?.runId ?? 'preview'}:${owner}" data-owner="${owner}" data-form="${form ?? `${owner}-original`}" data-active-tree="${activeTree}" data-selected="${selected ?? ''}" style="${skillTheme(form,owner)};--map-width:${layout.width}px;--map-height:${layout.height}px;--map-label-width:${layout.labelWidth}px" data-world-width="${layout.width}" data-world-height="${layout.height}" aria-label="${esc(name)}完整技能路線圖">
    <svg class="deep-connections network-edges" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
      <defs><mask id="network-labels-${owner}" maskUnits="userSpaceOnUse" x="0" y="0" width="${layout.width}" height="${layout.height}"><rect width="100%" height="100%" fill="white"/>${nodes.map(node => {
        const position = layout.positions.get(node.id)!;
        const radius = (node.kind === 'ultimate' ? SKILL_ULTIMATE_SIZE : SKILL_NODE_SIZE) / 2;
        return `<rect data-node-id="${node.id}" x="${position.x - (layout.labelWidth + 4) / 2}" y="${position.y + radius + 6}" width="${layout.labelWidth + 4}" height="36" rx="4" fill="black"/>`;
      }).join('')}</mask></defs>
      <g mask="url(#network-labels-${owner})">${layout.edges.filter(route => route.cross).map(edge).join('')}${layout.edges.filter(route => !route.cross).map(edge).join('')}</g>
    </svg>
    <div class="network-core" style="left:${layout.core.x}px;top:${layout.core.y}px" aria-hidden="true"><span>✧</span><b>${esc(name)}</b></div>
    ${trees.map((tree, index) => {
      const position = layout.badgePositions.get(tree.id)!;
      return `<button type="button" class="network-branch-badge" data-map-branch="${tree.id}" style="left:${position.x}px;top:${position.y}px" aria-pressed="false" aria-label="聚焦${esc(tree.name)}流派"><small>0${index + 1}</small><span>${esc(tree.name)}</span></button>`;
    }).join('')}
    ${nodes.sort((a,b) => a.layer - b.layer || a.atlas!.x - b.atlas!.x).map(node => {
      const position = layout.positions.get(node.id)!;
      const owned = !!run && deepHas(run, node.id), queued = pending.includes(node.id), cost = deepNodeCost(node.id, run);
      const reason = run && !owned && !queued ? deepLock(run,node.id) ?? (run.draft && cost > (run.draft.pointTarget ?? 0) - run.choicesSpent ? `需要 ${cost} 點，剩餘點數不足` : null) : null;
      const state = owned ? 'owned' : queued ? 'pending' : reason ? 'locked' : run ? 'available' : 'preview';
      const status = owned ? '已取得' : queued ? '待確認' : reason ?? `${cost} 點${run ? '可取得' : '預覽'}`;
      const capstone = !nodes.some(child => child.parents.includes(node.id)) && node.kind !== 'ultimate';
      const size = node.kind === 'ultimate' ? SKILL_ULTIMATE_SIZE : SKILL_NODE_SIZE;
      const parents = node.parents.map(id => nodes.find(parent => parent.id === id)?.name ?? DEEP_NODE_MAP[id].name).join(node.requires === 'any' ? ' 或 ' : '＋') || '入口，無前置';
      return `<button type="button" class="deep-node constellation-node ${state} ${node.kind} ${capstone ? 'capstone' : ''} ${selected === node.id ? 'inspecting' : ''} ${node.treeId === activeTree ? 'active-branch' : ''}" style="--node-x:${position.x}px;--node-y:${position.y}px;--node-size:${size}px" data-action="${action}" data-id="${node.id}" data-tree="${node.treeId}" data-node-kind="${node.kind}" data-route-name="${esc(trees.find(tree => tree.id === node.treeId)!.name)}" data-description="${esc(node.description)}" data-prerequisites="${esc(parents)}" data-state="${state}" data-cost="${cost}" data-layer="${node.layer}" data-x="${position.x}" data-y="${position.y}" aria-pressed="${selected === node.id}" aria-label="${esc(node.name)}，${esc(status)}${node.parents.length > 1 ? '，任一前置即可' : ''}">${node.kind === 'ultimate' ? ultimateOrbits : ''}<span class="node-symbol">${skillEmblem(node,form)}</span><strong>${esc(node.name)}</strong><small class="node-state-mark" aria-hidden="true">${owned ? '✓' : queued ? '+1' : state === 'available' ? '↑' : node.kind === 'ultimate' ? '2' : ''}</small></button>`;
    }).join('')}
  </div>`;
}
