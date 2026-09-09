import { offlineGame, type OfflineState } from '../offline';

export function offlineSummary() {
  return '<button class="offline-summary" data-offline="summary" data-action="settings" data-id="offline" data-offline-state="checking"><span class="offline-indicator" aria-hidden="true">↓</span><span data-offline-field="summary">正在確認離線下載</span><span class="offline-summary-arrow" aria-hidden="true">›</span><span class="sr-only" data-offline-field="announcement" role="status" aria-live="polite"></span></button>';
}
export function offlineSettings(embedded = false) {
  const heading = embedded ? 'h3' : 'h2';
  return `<section class="offline-settings" data-offline="settings" data-offline-state="checking" aria-label="離線遊玩與安裝">
    <${heading}>離線遊玩與安裝</${heading}>
    <p class="offline-title" data-offline-field="title" role="status" aria-live="polite">正在確認離線下載</p>
    <p data-offline-field="detail"></p>
    <div data-offline-progress-group hidden><progress data-offline-progress max="100" value="0" aria-label="完整遊戲下載進度"></progress><p class="offline-progress-label" data-offline-field="progress-label"></p></div>
    <p class="offline-error" data-offline-field="error" hidden></p>
    <div class="offline-actions"><button type="button" class="button secondary" data-offline-action="retry" hidden>重試離線下載</button><button type="button" class="button secondary" data-offline-action="install" hidden>安裝遊戲</button></div>
    <p data-offline-field="install-guide"></p><p data-offline-field="install-message" role="status" hidden></p>
    <p class="offline-storage-note">收藏、編隊、通關進度與設定保存在目前瀏覽器；未完成戰局在重開後結束。首次下載需要連網，清除網站資料後需重新下載。加入主畫面後，請在開啟的遊戲內確認進度與離線狀態。</p>
  </section>`;
}
function copy(state: OfflineState) {
  const progress = state.progress;
  const percent = progress?.total ? Math.floor(progress.completed / progress.total * 100) : 0;
  let title = '正在確認離線下載', detail = '完整遊戲會在背景下載，期間可以繼續遊玩。';
  if (state.phase === 'development') { title = '開發模式'; detail = '離線下載在正式版本啟用。'; }
  if (state.phase === 'unsupported') { title = '目前只能線上遊玩'; detail = '此瀏覽器或連線方式不支援離線儲存，請使用支援的瀏覽器開啟正式 HTTPS 網址。'; }
  if (state.phase === 'downloading') { title = '正在下載完整遊戲'; detail = '包含所有角色、造型、動畫與關卡；完成前請保持連線。'; }
  if (state.phase === 'downloaded') { title = '完整遊戲已下載'; detail = '請關閉此遊戲視窗，再從原網址或主畫面重新開啟，確認顯示「可離線遊玩」後再斷網。'; }
  if (state.phase === 'error') { title = '離線下載尚未完成'; detail = '目前可繼續線上遊玩。確認連線與裝置可用空間後，重試下載。'; }
  if (state.phase === 'ready') {
    title = '可離線遊玩'; detail = '完整遊戲已下載；之後可從主畫面或這個網址開啟遊玩。';
    if (state.update === 'downloading') detail = '正在背景下載新版；目前版本仍可離線遊玩。';
    if (state.update === 'waiting') detail = '新版已下載。關閉所有遊戲分頁與視窗後，下次開啟會套用更新。';
    if (state.update === 'error') detail = '新版下載未完成；目前版本仍可離線遊玩，可稍後重試更新。';
  }
  if (!state.online && state.phase !== 'ready' && !['unsupported', 'development', 'downloaded'].includes(state.phase)) detail = '目前沒有網路連線。重新連線後會繼續準備離線遊戲。';
  const summary = state.phase === 'ready' ? state.update === 'waiting' ? '可離線遊玩 · 新版待套用' : state.update === 'downloading' ? `可離線遊玩 · 更新 ${percent}%` : state.update === 'error' ? '可離線遊玩 · 更新未完成' : title : state.phase === 'downloading' ? `離線下載 ${percent}%` : state.phase === 'downloaded' ? '已下載 · 重新開啟確認離線' : title;
  const installGuide = state.install === 'standalone' ? '已從主畫面開啟。請確認上方顯示「可離線遊玩」後再斷網。' :
    state.install === 'installed' ? '已加入裝置。請開啟安裝的遊戲，確認顯示「可離線遊玩」。' :
    state.install === 'ios' ? 'iPhone／iPad：在 Safari 點「分享」→「加入主畫面」。安裝後先開啟遊戲並確認離線下載完成。' :
    state.install === 'available' ? '可將遊戲安裝到裝置。安裝後先開啟遊戲並確認離線下載完成。' :
    '若瀏覽器提供安裝或加入主畫面的選項，可從選單操作；也可直接使用這個網址。';
  return { title, detail, summary, percent, installGuide };
}
function setText(holder: Element, field: string, value: string) {
  const node = holder.querySelector<HTMLElement>(`[data-offline-field="${field}"]`);
  if (node && node.textContent !== value) node.textContent = value;
}
/** Patch only dedicated status nodes: never remount a scene, form, or focused button. */
export function refreshOfflineUi(root: HTMLElement) {
  const state = offlineGame.state, text = copy(state), progress = state.progress;
  for (const holder of root.querySelectorAll<HTMLElement>('[data-offline]')) {
    holder.dataset.offlineState = state.phase; holder.dataset.offlineUpdate = state.update;
    if (holder.dataset.offline === 'summary') holder.setAttribute('aria-label', `${text.summary}，查看離線下載與安裝設定`);
    setText(holder, 'summary', text.summary);
    setText(holder, 'announcement', text.title);
    const indicator = holder.querySelector('.offline-indicator');
    if (indicator) indicator.textContent = state.phase === 'ready' ? '✓' : state.phase === 'error' ? '!' : '↓';
    setText(holder, 'title', text.title); setText(holder, 'detail', text.detail);
    const showProgress = !!progress && (state.phase === 'downloading' || state.update === 'downloading');
    const group = holder.querySelector<HTMLElement>('[data-offline-progress-group]'); if (group) group.hidden = !showProgress;
    const bar = holder.querySelector<HTMLProgressElement>('[data-offline-progress]'); if (bar) bar.value = text.percent;
    const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1);
    setText(holder, 'progress-label', progress ? `${text.percent}% · ${progress.completed} / ${progress.total} 個檔案 · ${megabytes(progress.bytesLoaded)} / ${megabytes(progress.bytesTotal)} MB` : '');
    const error = holder.querySelector<HTMLElement>('[data-offline-field="error"]'); if (error) error.hidden = !state.error;
    setText(holder, 'error', state.error);
    const retry = holder.querySelector<HTMLButtonElement>('[data-offline-action="retry"]');
    if (retry) { retry.hidden = state.phase !== 'error' && state.update !== 'error'; retry.disabled = state.busy; retry.textContent = state.busy ? '正在重試…' : state.phase === 'ready' ? '重試更新' : '重試離線下載'; }
    const install = holder.querySelector<HTMLButtonElement>('[data-offline-action="install"]');
    if (install) { install.hidden = state.install !== 'available' && !state.installBusy; install.disabled = state.installBusy; install.textContent = state.installBusy ? '正在開啟安裝…' : '安裝遊戲'; }
    setText(holder, 'install-guide', text.installGuide);
    setText(holder, 'install-message', state.installMessage);
    const installMessage = holder.querySelector<HTMLElement>('[data-offline-field="install-message"]'); if (installMessage) installMessage.hidden = !state.installMessage;
  }
}
export function bindOfflineUi(root: HTMLElement) {
  offlineGame.subscribe(() => refreshOfflineUi(root));
  root.addEventListener('click', event => {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-offline-action]');
    if (!control || control.disabled) return;
    if (control.dataset.offlineAction === 'retry') void offlineGame.retry();
    if (control.dataset.offlineAction === 'install') void offlineGame.install();
  });
}
