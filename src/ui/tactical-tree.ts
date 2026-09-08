import type { MobileControls } from './mobile-controls';

/** Keep the complete graph connected. Only the map scrolls on short screens. */
export function enhanceTacticalTree(panel: HTMLElement, ui: MobileControls) {
  panel.classList.add('tactical-tree');
  const scroll = panel.querySelector<HTMLElement>('.tree-scroll')!;
  const graph = scroll.querySelector<HTMLElement>('.deep-graph')!;
  const key = panel.dataset.treeId!;
  const nodes = [...graph.querySelectorAll<HTMLElement>('.deep-node')];
  const rows = Math.max(...nodes.map(node => Number(node.dataset.layer))) + 1;
  graph.style.setProperty('--map-rows', String(rows));
  for (const node of nodes) {
    node.style.setProperty('--map-row', node.dataset.layer!);
    if(node.classList.contains('ultimate')){const symbol=node.querySelector('.node-symbol')!;symbol.textContent=`${symbol.textContent} ${node.dataset.cost} 點`;}
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'skill-map-toolbar';
  const legend = document.createElement('div');
  legend.className = 'skill-map-legend';
  legend.setAttribute('aria-label', '節點狀態');
  legend.innerHTML = '<span class="owned">✓ 已取得</span><span class="available">＋ 可解鎖</span><span class="locked">◇ 待解鎖</span>';
  toolbar.append(legend);
  graph.before(toolbar);
  const context = [...scroll.querySelectorAll<HTMLElement>(':scope > .operation-intel, :scope > .tree-intro, :scope > .tree-path-note, :scope > .tree-owned')];
  ui.detail(`combat-context:${key}`, '敵情／構築', context, toolbar);

  const viewport = document.createElement('div');
  viewport.className = 'skill-map-viewport';
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', '完整技能路線圖');
  graph.before(viewport);
  viewport.append(graph);

  const footer = panel.querySelector<HTMLElement>('.node-preview')!;
  const description = footer.querySelector<HTMLElement>(':scope > div')!;
  const summary = document.createElement('div');
  summary.className = 'skill-selection';
  const copy = document.createElement('div');
  copy.className = 'skill-selection-copy';
  for (const item of description.querySelectorAll('h3, p')) copy.append(item.cloneNode(true));
  const reason = description.querySelector('small');
  if (graph.querySelector('.inspecting.locked') && reason) copy.append(reason.cloneNode(true));
  summary.append(copy);
  footer.prepend(summary);
  ui.detail(`combat-node:${key}`, '效果／前置', [description], summary);
}
