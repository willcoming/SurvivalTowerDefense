import type { Page } from './model';
import { MobileControls } from './mobile-controls';
import { enhanceSecondary } from './mobile-secondary';
import { enhanceBattleFocus } from './battle-focus';

export const mobileQuery = '(max-width: 800px)';

function mount(parent: HTMLElement, className: string, label?: string, before?: Element | null) {
  const element = document.createElement('div');
  element.className = className;
  if (label) element.dataset.label = label;
  parent.insertBefore(element, before ?? null);
  return element;
}

function compactRoster(root: HTMLElement, ui: MobileControls) {
  const main = root.querySelector<HTMLElement>('.roster-screen');
  if (!main) return;
  const intro = main.querySelector<HTMLElement>('.page-intro')!;
  const help = mount(intro, 'mobile-inline-help');
  const notes = main.querySelector<HTMLElement>('.roster-help-copy')!;
  const disclosure = main.querySelector<HTMLElement>('.roster-help')!;
  const button = ui.detail('roster-notes', '編隊說明與推薦', [notes], help);
  button.textContent = '編隊說明 ⓘ';
  button.setAttribute('aria-label', '編隊說明與推薦');
  disclosure.remove();
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
  controls.append(main.querySelector<HTMLElement>('.personnel-skills-trigger')!);
  const enemies = main.querySelector<HTMLElement>('.enemy-codex')!;
  const enemyGrid = enemies.querySelector<HTMLElement>('.enemy-grid')!;
  const entries = [...enemyGrid.querySelectorAll<HTMLElement>('.enemy-info')];
  const enemyPicker = mount(enemies, 'mobile-enemy-picker', '選擇敵人', enemyGrid);
  ui.pager('codex-enemies', entries, entries.map(entry => entry.querySelector('h3')!.firstChild!.textContent!.trim()), enemyPicker);
  ui.detail('codex-enemies-detail', '敵人情報', [enemies], controls);
}

export function enhanceMobile(root: HTMLElement, page: Page, ui: MobileControls) {
  root.classList.add('mobile-app');
  root.dataset.page = page;
  if (page === 'battle') { enhanceBattleFocus(root); return; }
  const nav = root.querySelector<HTMLElement>('.main-nav')!;
  root.append(nav);
  if (page === 'roster') compactRoster(root, ui);
  else if (page === 'codex') compactCodex(root, ui);
  else enhanceSecondary(root, page, ui);
}
