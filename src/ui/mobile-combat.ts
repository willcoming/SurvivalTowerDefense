import type { MobileControls } from './mobile-controls';

function region(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function tree(panel: HTMLElement, ui: MobileControls) {
  const scroll = panel.querySelector<HTMLElement>('.tree-scroll')!;
  const graph = panel.querySelector<HTMLElement>('.deep-graph, .node-graph')!;
  const footer = panel.querySelector<HTMLElement>('.node-preview')!;
  const key = panel.dataset.treeId ?? 'tree';
  panel.classList.add('mobile-tree');

  const toolbar = region('mobile-combat-toolbar');
  toolbar.dataset.label = '技能階段';
  graph.before(toolbar);
  const context = [...scroll.querySelectorAll<HTMLElement>(':scope > .operation-intel, :scope > .tree-intro, :scope > .tree-path-note, :scope > .tree-owned, :scope > .common-route-labels, :scope > .tree-common')];
  ui.detail(`combat-context:${key}`, '敵情／構築', context, toolbar);

  const nodes = [...graph.querySelectorAll<HTMLButtonElement>('.deep-node, .skill-node')];
  const layers = [...new Set(nodes.map(node => Number(node.dataset.layer)))].sort((a, b) => a - b);
  const pages = layers.map(layer => {
    const page = region('mobile-node-page');
    page.append(...nodes.filter(node => Number(node.dataset.layer) === layer));
    graph.append(page);
    return page;
  });
  const current = nodes.find(node => node.getAttribute('aria-pressed') === 'true') ?? nodes.find(node => node.dataset.state === 'available');
  ui.pager(`combat-layers:${key}`, pages, layers.map((layer, index) => {
    const ultimate = pages[index].querySelector('.ultimate, .node-ultimate');
    return `${index + 1}/${layers.length} · ${layer === 0 ? '入口' : ultimate ? '終極' : `第 ${layer + 1} 層`}`;
  }), toolbar, Math.max(0, layers.indexOf(Number(current?.dataset.layer ?? 0))));

  const description = footer.querySelector<HTMLElement>(':scope > div')!;
  const summary = region('mobile-node-summary');
  const copy = region('mobile-node-copy');
  for (const item of description.querySelectorAll('h3, p')) copy.append(item.cloneNode(true));
  if (graph.querySelector('.inspecting.locked')) {
    const reason = description.querySelector('small');
    if (reason) {
      const note = reason.cloneNode(true) as HTMLElement;
      note.className = 'mobile-node-lock';
      copy.append(note);
    }
  }
  summary.append(copy);
  footer.prepend(summary);
  ui.detail(`combat-node:${key}`, '效果／前置', [description], summary);
}

function tutorial(panel: HTMLElement, ui: MobileControls) {
  panel.classList.add('mobile-combat-dialog', 'mobile-tutorial');
  const steps = panel.querySelector<HTMLOListElement>('.tutorial-steps')!;
  const items = [...steps.querySelectorAll<HTMLElement>('li')];
  const toolbar = region('mobile-combat-toolbar');
  toolbar.dataset.label = '操作引導';
  steps.before(toolbar);
  ui.pager('combat-tutorial', items, items.map((item, i) => `${i + 1}/${items.length} · ${item.querySelector('strong')!.textContent}`), toolbar);
}

function pause(panel: HTMLElement, ui: MobileControls) {
  panel.classList.add('mobile-combat-dialog', 'mobile-pause');
  const settings = panel.querySelector<HTMLElement>('.embedded-settings');
  const build = panel.querySelector<HTMLElement>('.inline-build');
  if (settings || build) {
    const mount = region('mobile-combat-toolbar');
    (settings ?? build)!.before(mount);
    if (settings) ui.detail('combat-settings', '音量與戰鬥設定', [settings], mount);
    if (build) ui.detail('combat-build', '構築詳情', [build], mount);
  }
}

function upgrade(panel: HTMLElement, ui: MobileControls) {
  panel.classList.add('mobile-combat-dialog', 'mobile-upgrade');
  const cards = panel.querySelector<HTMLElement>('.upgrade-cards')!;
  const items = [...cards.querySelectorAll<HTMLElement>('.upgrade-card')];
  const toolbar = region('mobile-combat-toolbar');
  toolbar.dataset.label = '升級候選';
  cards.before(toolbar);
  ui.pager(`combat-candidates:${items.map(item => item.dataset.id).join(',')}`, items,
    items.map((item, index) => `${index + 1}/${items.length} · ${item.querySelector('.upgrade-copy > strong')!.textContent}`),
    toolbar, Math.max(0, items.findIndex(item => item.classList.contains('selected'))));

  const details = region('mobile-upgrade-details');
  for (const item of items) {
    const info = document.createElement('section');
    const title = document.createElement('h3');
    title.textContent = item.querySelector('.upgrade-copy > strong')!.textContent;
    info.append(title);
    for (const text of item.querySelectorAll('.card-meta, .upgrade-effect, .upgrade-before, .upgrade-counter, .upgrade-tradeoff')) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text.textContent;
      info.append(paragraph);
    }
    details.append(info);
  }
  ui.detail('combat-candidate-details', '候選詳情', [details], toolbar);
  const build = panel.querySelector<HTMLElement>('.inline-build');
  if (build) ui.detail('combat-upgrade-build', '目前構築', [build], toolbar);
}

/** Reorganize presentation only; all choices still reach the existing game actions. */
export function enhanceMobileCombat(holder: HTMLElement, ui: MobileControls) {
  if (!window.matchMedia('(max-width: 800px)').matches) return;
  for (const panel of holder.querySelectorAll<HTMLElement>('.tree-panel:not(.mobile-tree)')) tree(panel, ui);
  for (const panel of holder.querySelectorAll<HTMLElement>('.tutorial-dialog:not(.mobile-combat-dialog)')) tutorial(panel, ui);
  for (const panel of holder.querySelectorAll<HTMLElement>('.pause-dialog:not(.mobile-combat-dialog)')) pause(panel, ui);
  for (const panel of holder.querySelectorAll<HTMLElement>('.upgrade-dialog:not(.mobile-combat-dialog)')) upgrade(panel, ui);
}
