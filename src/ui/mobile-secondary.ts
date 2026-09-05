import type { Page } from './model';
import type { MobileControls } from './mobile-controls';

const find = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector);
const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
let previousReceipt: string | null | undefined;

function block(className: string, tag = 'div') {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function detail(ui: MobileControls, key: string, label: string, nodes: (HTMLElement | null)[], mount: HTMLElement) {
  const content = nodes.filter((node): node is HTMLElement => !!node);
  if (!content.length) return;
  content.forEach(node => node.classList.add('mobile-secondary-detail-content'));
  return ui.detail(key, label, content, mount);
}

function compactIntel(screen: HTMLElement, ui: MobileControls) {
  const information = block('mobile-secondary-links');
  const banner = find(screen, '.intel-banner');
  banner?.after(information);
  detail(ui, 'intel-information', '作戰情報與敵方對策', [
    find(screen, '.page-intro > p'), find(screen, '.briefing-dialogue'), find(screen, '.intel-columns'),
    find(screen, '.challenge-select .section-heading small'),
  ], information);
  screen.classList.add('mobile-intel');
}

function compactRecruitment(screen: HTMLElement, ui: MobileControls) {
  const nav = block('mobile-secondary-navigation');
  nav.dataset.label = '招募與收藏';
  const drawPanel = block('mobile-recruit-draw', 'section');
  const collectionPanel = block('mobile-recruit-collection', 'section');
  const information = block('mobile-secondary-links');
  find(screen, '.page-intro')?.after(nav, drawPanel, collectionPanel);

  const console = find(screen, '.recruitment-console');
  const receipt = find(screen, '.recruitment-receipt');
  if (console) drawPanel.append(console);
  if (receipt) drawPanel.append(receipt);
  drawPanel.classList.toggle('has-receipt', !!receipt);
  const overview = block('mobile-recruit-overview');
  const banner = find(screen, '.recruitment-banner');
  const image = find(banner ?? screen, '.recruitment-banner > img');
  // The full illustration remains available in the collection information sheet.
  if (image) overview.append(image.cloneNode(true));
  const message = document.createElement('p');
  message.textContent = '常駐混合獎池 · 10 項各 10%\n完全免費，以不同形態搭配小隊。';
  overview.append(message);
  drawPanel.prepend(overview);

  const progress = find(screen, '.collection-progress');
  const grid = find(screen, '.collection-grid');
  const chooser = block('mobile-collection-chooser');
  chooser.dataset.label = '選擇收藏形態';
  if (progress) collectionPanel.append(progress);
  collectionPanel.append(chooser);
  if (grid) collectionPanel.append(grid);

  const cards = grid ? all(grid, '.collection-card') : [];
  cards.forEach((card, index) => {
    const copy = find(card, ':scope > div');
    const image = find(card, ':scope > img');
    const passive = find(card, ':scope > div > p');
    const links = block('mobile-collection-card-links');
    if (copy) {
      const heading = find(copy, 'h2');
      const header = block('mobile-collection-card-heading');
      if (image) header.append(image.cloneNode(true));
      if (heading) header.append(heading);
      card.prepend(header);
      copy.append(links);
      detail(ui, `collection-form-${index}`, '形態能力與完整立繪', [image, passive], links);
    }
  });
  if (cards.length) ui.pager('recruitment-forms', cards, cards.map(card => find(card, 'h2')?.textContent ?? '收藏形態'), chooser);
  screen.append(information);
  const drawNote = find(console ?? screen, '.recruitment-console > .quiet-note');
  const activeRunNote = drawNote?.textContent?.startsWith('請先完成') ? drawNote : null;
  if (activeRunNote) {
    message.textContent = activeRunNote.textContent;
    const drawButton = find(console ?? screen, '[data-action="draw"]');
    if (drawButton) drawButton.textContent = '行動進行中 · 暫停招募';
  }
  detail(ui, 'recruitment-information', '獎池說明與取得方式', [
    find(screen, '.page-intro > p'), banner, drawNote,
    find(screen, '.collection-progress > progress'), find(screen, '.collection-progress > p'), find(screen, '.reward-ledger'),
    ...all(screen, ':scope > .quiet-note'),
  ], information);
  ui.tabs('recruitment-sections', [drawPanel, collectionPanel], ['招募', '收藏與兌換'], nav);
  const receiptKey = receipt?.querySelector('.eyebrow')?.textContent ?? null;
  if (receiptKey && previousReceipt !== undefined && previousReceipt !== receiptKey) {
    // A newly completed exchange must reveal its receipt even from the collection tab.
    nav.querySelector<HTMLButtonElement>('button')?.click();
  }
  previousReceipt = receiptKey;
  screen.classList.add('mobile-recruitment');
}

function compactStories(screen: HTMLElement, ui: MobileControls) {
  const journal = find(screen, '.journal');
  if (!journal) return;
  const chooser = block('mobile-journal-chooser');
  chooser.dataset.label = '選擇行動紀錄';
  journal.before(chooser);
  const entries = all(journal, '.journal-entry');
  entries.forEach((entry, index) => {
    const copy = find(entry, ':scope > div');
    if (!copy) return;
    const links = block('mobile-secondary-links');
    copy.append(links);
    detail(ui, `journal-entry-${index}`, entry.classList.contains('unlocked') ? '閱讀行動紀錄' : '查看解鎖條件', all(copy, ':scope > p'), links);
  });
  ui.pager('journal-stage', entries, entries.map(entry => {
    const title = find(entry, 'h2')?.textContent ?? '行動紀錄';
    return `${entry.classList.contains('unlocked') ? '✓' : '▣'} ${title}`;
  }), chooser);
  const information = block('mobile-secondary-links mobile-journal-history');
  screen.append(information);
  detail(ui, 'journal-recent-runs', '最近行動與戰績', [find(screen, '.recent-runs'), find(screen, '.page-intro > p')], information);
  screen.classList.add('mobile-stories');
}

function compactSettings(screen: HTMLElement, ui: MobileControls) {
  const nav = block('mobile-secondary-navigation');
  nav.dataset.label = '設定分類';
  const preferences = block('mobile-settings-preferences', 'section');
  const storage = block('mobile-settings-storage', 'section');
  find(screen, '.page-intro')?.after(nav, preferences, storage);
  const notes = block('mobile-settings-explanations');
  all(screen, '.setting-row').forEach(row => {
    const label = find(row, 'label');
    const note = find(row, 'small');
    if (label && note) {
      const entry = block('mobile-settings-explanation', 'section');
      const title = document.createElement('h3');
      title.textContent = [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
      entry.append(title, note);
      notes.append(entry);
    }
    preferences.append(row);
  });
  const preferencesHelp = block('mobile-secondary-links');
  preferences.append(preferencesHelp);
  detail(ui, 'settings-explanations', '設定說明', [notes], preferencesHelp);
  const save = find(screen, '.save-information');
  const danger = find(screen, '.danger-zone');
  if (save) storage.append(save);
  if (danger) storage.append(danger);
  const storageHelp = block('mobile-secondary-links');
  storage.append(storageHelp);
  detail(ui, 'settings-save-information', '本機存檔說明', [find(save ?? screen, '.save-information > p')], storageHelp);
  ui.tabs('settings-sections', [preferences, storage], ['音效與顯示', '存檔管理'], nav);
  screen.classList.add('mobile-settings');
}

function compactResult(screen: HTMLElement, ui: MobileControls) {
  const information = block('mobile-secondary-links mobile-result-information');
  const actions = find(screen, '.result-actions');
  actions?.before(information);
  const runDetails = find(screen, '.run-details');
  if (runDetails instanceof HTMLDetailsElement) runDetails.open = true;
  detail(ui, 'result-report', '戰鬥報告與行動後記', [
    ...all(screen, '.result-rewards > .eyebrow, .result-rewards > p'),
    find(screen, '.result-story'), find(screen, '.result-insight'),
    find(screen, '.result-columns'), runDetails,
  ], information);
  screen.classList.add('mobile-result');
}

/** Reuses rendered action controls so all existing game and collection rules remain authoritative. */
export function enhanceSecondary(root: HTMLElement, page: Page, ui: MobileControls) {
  const screen = find(root, '.content-screen');
  if (!screen) return;
  const enhancers: Partial<Record<Page, (screen: HTMLElement, ui: MobileControls) => void>> = {
    intel: compactIntel,
    recruitment: compactRecruitment,
    stories: compactStories,
    settings: compactSettings,
    result: compactResult,
  };
  const enhance = enhancers[page];
  if (!enhance) return;
  screen.classList.add('mobile-secondary');
  enhance(screen, ui);
}
