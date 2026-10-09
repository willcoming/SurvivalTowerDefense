import type { MobileControls } from './mobile-controls';

/** Keep the complete graph connected. Only the map scrolls on short screens. */
export function enhanceTacticalTree(panel: HTMLElement, ui: MobileControls) {
  panel.classList.add('tactical-tree');
  const scroll = panel.querySelector<HTMLElement>('.tree-scroll')!;
  const graph = scroll.querySelector<HTMLElement>('.deep-graph')!;
  const key = panel.dataset.treeId!;
  const characters = scroll.querySelector<HTMLElement>('.tree-characters')!;
  panel.querySelector('.tree-header')!.append(characters);

  const toolbar = document.createElement('div');
  toolbar.className = 'skill-map-toolbar';
  const legend = document.createElement('div');
  legend.className = 'skill-map-legend';
  legend.setAttribute('aria-label', '節點狀態');
  legend.innerHTML = '<span class="owned">● 已取得</span><span class="available">○ 可配置</span><span class="pending">◉ 待確認</span>';
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

}
