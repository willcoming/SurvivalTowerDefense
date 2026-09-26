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
  legend.innerHTML = '<span class="owned">● 已取得</span><span class="available">○ 可解鎖</span><span class="pending">◉ 待確認</span><span class="locked">● 未解鎖</span>';
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
  if (matchMedia('(max-width:800px)').matches && panel.classList.contains('wave-allocation')) {
    const confirm = footer.querySelector<HTMLElement>('[data-action=buy-node]')!;
    const points = confirm.textContent?.match(/· (\d+) 點/)?.[1] ?? '0';
    confirm.textContent = `確認 ${points} 點`;
    confirm.setAttribute('aria-label', `確認配置並繼續，${points} 點`);
    const bank = footer.querySelector<HTMLElement>('[data-action=bank-wave-points]')!;
    bank.textContent = '保留全部點數';
    bank.setAttribute('aria-label', '保留全部點數並繼續');
  }
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
  const note = matchMedia('(max-width:800px)').matches ? footer.querySelector<HTMLElement>('.deep-footer-note > small') : null;
  ui.detail(`combat-node:${key}`, '效果／前置', note ? [description, note] : [description], summary);
}
