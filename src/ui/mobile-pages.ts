import type { Page } from './model';
import type { MobileControls } from './mobile-controls';

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
function mount(parent: Element, className: string, label?: string) {
  const node = document.createElement('div');
  node.className = className;
  if (label) node.dataset.label = label;
  parent.append(node);
  return node;
}
function disclose(ui: MobileControls, key: string, label: string, element: HTMLElement, parent: HTMLElement) {
  if (element instanceof HTMLDetailsElement) element.open = true;
  return ui.detail(key, label, [element], parent);
}

function roster(main: HTMLElement, ui: MobileControls) {
  const grid = main.querySelector<HTMLElement>('.roster-overview');
  if (!grid) return;
  if (innerHeight <= 650) {
    const lineup = main.querySelector<HTMLElement>('.roster-lineup');
    const help = main.querySelector('[data-detail=roster-notes] .mobile-detail-body');
    if (lineup && help) help.prepend(lineup);
  }
  const picker = mount(main, 'mobile-page-picker', '隊員');
  grid.before(picker);
  const items = all(grid, '.roster-tile');
  ui.pager('roster-members', items, items.map(n => n.querySelector('strong')!.textContent!), picker, 0, innerHeight <= 650 ? 2 : 4);
}

function recruitment(main: HTMLElement, ui: MobileControls) {
  const catalog = main.querySelector<HTMLElement>('.recruit-v2-catalog')!;
  const grid = catalog.querySelector<HTMLElement>('.recruit-card-grid')!;
  const receipt = catalog.querySelector<HTMLElement>('.recruitment-receipt');
  if (receipt) {
    const links = mount(main.querySelector('.recruit-purchase-panel') ?? catalog, 'mobile-recruit-receipt');
    const result = disclose(ui, 'recruit-receipt', '招募結果', receipt, links);
    result.setAttribute('aria-label', '招募結果');
    result.setAttribute('aria-live', 'polite');
  }
  const picker = mount(catalog, 'mobile-page-picker', '獎池項目');
  grid.before(picker);
  const items = all(grid, '.recruit-item');
  for (const item of items) {
    const image = item.querySelector<HTMLElement>('[data-action=recruit-preview]')!;
    item.dataset.mobileKey = image.dataset.id;
    const ability = item.querySelector<HTMLElement>('details')!;
    const links = mount(item.querySelector('.recruit-item-copy')!, 'mobile-recruit-ability');
    disclose(ui, `recruit-ability:${image.dataset.id}`, '能力詳情', ability, links);
  }
  const status = catalog.querySelector<HTMLElement>('.recruit-catalog-meta')!;
  const collection = status.querySelector('span')!.textContent!;
  status.classList.add('sr-only');
  ui.pager('recruit-items', items, items.map(n => `${collection} · ${n.querySelector('h2')!.textContent}・${n.querySelector('.recruit-item-copy > p')!.textContent}`), picker, 0, innerHeight <= 740 ? 1 : 2);
}

function commander(main: HTMLElement, ui: MobileControls) {
  const routes = all(main, '.commander-route');
  const picker = mount(main, 'mobile-commander-tabs', '共用技能路線');
  main.querySelector('.commander-routes')!.before(picker);
  routes.forEach(route => {
    for (const node of all(route, 'li')) {
      const copy = node.querySelector<HTMLElement>('div')!;
      const upgrade = copy.querySelector<HTMLButtonElement>('button')!;
      const name = copy.querySelector('h4')!.textContent!;
      const key = `commander-node:${upgrade.dataset.id}`;
      const trigger = ui.detail(key, name, [copy], node, [upgrade]);
      trigger.classList.add('mobile-commander-node');
      const state = document.createElement('small');
      state.textContent = node.classList.contains('owned') ? '已升級' : '查看效果與條件';
      trigger.append(state);
    }
  });
  ui.tabs('commander-routes', routes, routes.map(n => n.querySelector('h3')!.textContent!), picker);
  const links = mount(main, 'mobile-commander-information');
  const rules = main.querySelector<HTMLElement>('.commander-rules')!;
  const details = [rules, ...all(main, '.commander-experience,.commander-allocation-heading p,.commander-heading p,.commander-points > small')];
  if (rules instanceof HTMLDetailsElement) rules.open = true;
  ui.detail('commander-rules', '成長規則與經驗表', details, links);
}

function hundred(main: HTMLElement, ui: MobileControls) {
  const rules = main.querySelector<HTMLElement>('.hundred-rules')!;
  const links = mount(main, 'mobile-hundred-information');
  rules.before(links);
  disclose(ui, 'hundred-rules', '挑戰規則與計分', rules, links);
  const intro = main.querySelector<HTMLElement>('.page-intro > p');
  const summary = main.querySelector<HTMLElement>('.hundred-summary');
  if (intro) rules.append(intro);
  if (summary) rules.append(summary);
}

function tactical(main: HTMLElement, ui: MobileControls) {
  const content = main.querySelector<HTMLElement>('.tactical-content')!;
  const tab = main.querySelector('[aria-selected=true]')!;
  const nodes = [...content.children] as HTMLElement[];
  const summary = document.createElement('p');
  const articles = content.querySelectorAll('article').length;
  summary.className = 'mobile-tactical-summary';
  summary.textContent = articles ? `${articles} 項${tab.textContent}，開啟詳情查看完整對策。` : '關卡目標、技能預算與首領對策。';
  content.append(summary);
  ui.detail(`tactical:${tab.id}`, `閱讀完整${tab.textContent}`, nodes, content);
}

function stories(main: HTMLElement) {
  const intro = main.querySelector<HTMLElement>('.page-intro > p');
  const detail = main.querySelector('[data-detail=journal-recent-runs] .mobile-detail-body');
  if (intro && detail) detail.append(intro);
}

function codex(main: HTMLElement, _ui: MobileControls) {
  const personnel = main.querySelector<HTMLElement>('[data-detail=codex-personnel] .mobile-detail-body')!;
  const forms = main.querySelector<HTMLElement>('.dossier-copy .form-controls');
  if (forms) {
    const passive = forms.querySelector('[data-detail=codex-form] .mobile-detail-body');
    if (passive) personnel.append(...passive.children);
    forms.querySelector('.mobile-form-help')?.remove();
    personnel.append(forms);
  }
  const nav = main.querySelector<HTMLElement>('.character-tabs');
  if (!nav) return;
  const picker = document.createElement('select');
  picker.setAttribute('aria-label', '圖鑑角色');
  const buttons = all(nav, 'button');
  for (const button of buttons) {
    const option = new Option(button.textContent!.trim(), button.dataset.id);
    option.selected = button.classList.contains('active') || button.classList.contains('selected') || button.getAttribute('aria-pressed') === 'true';
    picker.add(option);
  }
  picker.addEventListener('change', () => buttons.find(b => b.dataset.id === picker.value)?.click());
  nav.hidden = true;
  nav.after(picker);
}

/** Mobile-only presentation. Original action buttons keep their existing handlers. */
export function enhanceMobilePages(root: HTMLElement, page: Page, ui: MobileControls) {
  const main = root.querySelector<HTMLElement>('main');
  if (!main) return;
  const enhance: Partial<Record<Page, (main: HTMLElement, ui: MobileControls) => void>> = {
    roster, recruitment, commander, hundred, command: tactical, codex, stories,
  };
  if (!enhance[page]) return;
  main.classList.add('mobile-paged-screen');
  enhance[page]!(main, ui);
}
