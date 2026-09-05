import type { Page } from './model';
import { MobileControls } from './mobile-controls';
import { enhanceSecondary } from './mobile-secondary';
import { stageArt } from '../data/campaign';

export const mobileQuery = '(max-width: 800px)';

function mount(parent: HTMLElement, className: string, label?: string, before?: Element | null) {
  const element = document.createElement('div');
  element.className = className;
  if (label) element.dataset.label = label;
  parent.insertBefore(element, before ?? null);
  return element;
}

function compactHome(root: HTMLElement, ui: MobileControls) {
  root.querySelector('.hero h1')!.textContent = '防線就緒，準備出擊。';
  const panel = root.querySelector<HTMLElement>('.operation-panel')!;
  const campaign = panel.querySelector<HTMLElement>('.campaign-selector')!;
  const chapters = [...campaign.querySelectorAll<HTMLElement>('.chapter-group')];
  const controls = mount(panel, 'mobile-chapter-controls', '選擇章節', campaign);
  ui.pager('home-chapter', chapters, chapters.map(chapter => chapter.querySelector('h3')!.textContent!.trim()), controls,
    Math.max(0, chapters.findIndex(chapter => chapter.querySelector('.selected'))));
  const note = panel.querySelector<HTMLElement>(':scope > .quiet-note');
  if (note) {
    const notes = mount(root.querySelector<HTMLElement>('.masthead-right')!, 'mobile-home-notes');
    const button = ui.detail('home-notes', '作戰說明', [note], notes);
    button.textContent = 'ⓘ';
    button.setAttribute('aria-label', '作戰說明');
  }
}

function compactRoster(root: HTMLElement, ui: MobileControls) {
  const main = root.querySelector<HTMLElement>('.roster-screen')!;
  const intro = main.querySelector<HTMLElement>('.page-intro')!;
  intro.querySelector('h1')!.textContent = '小隊編成';
  const help = mount(intro, 'mobile-inline-help');
  const notes = ['.page-intro > p', '.formation-capabilities', '.recommendations']
    .map(selector => main.querySelector<HTMLElement>(selector)).filter((node): node is HTMLElement => !!node);
  ui.detail('roster-notes', '編隊說明與推薦', notes, help);
  const grid = main.querySelector<HTMLElement>('.roster-grid')!;
  const cards = [...grid.querySelectorAll<HTMLElement>('.character-card')];
  const picker = mount(main, 'mobile-roster-picker', '選擇隊員', grid);
  ui.pager('roster-character', cards, cards.map(card => card.querySelector('h2')!.textContent!), picker);
  for (const card of cards) {
    const passive = card.querySelector<HTMLElement>('.form-controls > small');
    if (passive) {
      const details = mount(card.querySelector<HTMLElement>('.form-controls')!, 'mobile-form-help');
      const button = ui.detail(`form-${card.querySelector<HTMLElement>('[data-id]')!.dataset.id}`, '形態能力詳情', [passive], details);
      button.textContent = '詳情';
      button.setAttribute('aria-label', '形態能力詳情');
    }
  }
}

function compactCodex(root: HTMLElement, ui: MobileControls) {
  const main = root.querySelector<HTMLElement>('.codex-screen')!;
  main.querySelector('h1')!.textContent = '科技圖鑑';
  const dossier = main.querySelector<HTMLElement>('.dossier')!;
  const copy = dossier.querySelector<HTMLElement>('.dossier-copy')!;
  const controls = mount(main, 'mobile-codex-details');
  const art = dossier.querySelector<HTMLElement>('.dossier-art')!;
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.className = 'mobile-portrait-preview';
  preview.setAttribute('aria-label', '查看完整角色立繪');
  const image = art.querySelector('img')!.cloneNode(true);
  preview.append(image);
  dossier.prepend(preview);
  const detailNodes = [art, ...['.character-description', '.weapon-info', '.skill-definitions']
    .map(selector => copy.querySelector<HTMLElement>(selector)).filter((node): node is HTMLElement => !!node)];
  const artTrigger = ui.detail('codex-personnel', '角色與武器詳情', detailNodes, controls);
  preview.addEventListener('click', () => artTrigger.click());
  const passive = copy.querySelector<HTMLElement>('.form-controls > small');
  if (passive) {
    const formHelp = mount(copy.querySelector<HTMLElement>('.form-controls')!, 'mobile-form-help');
    const button = ui.detail('codex-form', '形態能力詳情', [passive], formHelp);
    button.textContent = '詳情';
    button.setAttribute('aria-label', '形態能力詳情');
  }
  const routes = main.querySelector<HTMLElement>('.route-comparison')!;
  const columns = routes.querySelector<HTMLElement>('.route-columns')!;
  const trees = [...columns.querySelectorAll<HTMLElement>(':scope > article')];
  const treePicker = mount(routes, 'mobile-codex-tree-picker', '選擇技能路線', columns);
  ui.pager(`codex-routes-${copy.querySelector('h2')!.textContent}`, trees,
    trees.map(tree => tree.querySelector('h3')!.firstChild!.textContent!), treePicker);
  const nodeDetail = routes.querySelector<HTMLElement>('#codex-node-detail')!;
  treePicker.after(nodeDetail);
  ui.detail('codex-skills', '技能樹與節點', [routes], controls);
  const enemies = main.querySelector<HTMLElement>('.enemy-codex')!;
  const enemyGrid = enemies.querySelector<HTMLElement>('.enemy-grid')!;
  const entries = [...enemyGrid.querySelectorAll<HTMLElement>('.enemy-info')];
  const enemyPicker = mount(enemies, 'mobile-enemy-picker', '選擇敵人', enemyGrid);
  ui.pager('codex-enemies', entries, entries.map(entry => entry.querySelector('h3')!.firstChild!.textContent!.trim()), enemyPicker);
  ui.detail('codex-enemies-detail', '敵人情報', [enemies], controls);
}

export function enhanceMobile(root: HTMLElement, page: Page, ui: MobileControls) {
  const active = matchMedia(mobileQuery).matches;
  root.classList.toggle('mobile-app', active);
  root.dataset.page = page;
  if (!active || page === 'battle') return;
  const scene = document.createElement('div');
  scene.className = 'mobile-game-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.style.backgroundImage = root.querySelector<HTMLElement>('.hero-scenery, .intel-banner')?.style.backgroundImage ?? `url("${stageArt('S01')}")`;
  root.prepend(scene);
  const nav = root.querySelector<HTMLElement>('.main-nav')!;
  const labels: Record<string, [string, string]> = { home: ['⌖', '作戰'], roster: ['◈', '編隊'], recruitment: ['✦', '招募'], codex: ['◇', '圖鑑'], stories: ['▤', '紀錄'] };
  nav.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    const [icon, label] = labels[button.dataset.action!]!;
    button.setAttribute('aria-label', button.textContent!);
    const symbol = document.createElement('span'); symbol.className = 'game-nav-icon'; symbol.textContent = icon; symbol.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'game-nav-label'; text.textContent = label;
    button.replaceChildren(symbol, text);
  });
  root.append(nav);
  if (page === 'home') compactHome(root, ui);
  else if (page === 'roster') compactRoster(root, ui);
  else if (page === 'codex') compactCodex(root, ui);
  else enhanceSecondary(root, page, ui);
}
