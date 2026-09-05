import type { MobileControls } from './mobile-controls';

function noticeLabel(message: string) {
  if (/暫時.*試玩|試玩.*儲存/.test(message)) return '暫時試玩中';
  if (/素材/.test(message)) return '素材需要處理';
  if (/儲存|存檔|紀錄|分頁/.test(message)) return '存檔需要處理';
  if (/停頓|暫停/.test(message)) return '行動已暫停';
  return '作戰通知';
}

/** Keep recovery notices visible without pushing the mobile command screen down. */
export function enhanceMobileNotice(root: HTMLElement, ui: MobileControls) {
  if (!matchMedia('(max-width: 800px)').matches) return;
  for (const notice of root.querySelectorAll<HTMLElement>('.system-notice:not(.mobile-notice)')) {
    const message = notice.querySelector<HTMLElement>(':scope > span')?.textContent ?? '';
    const content = document.createElement('section');
    content.className = 'mobile-notice-content';
    content.append(...notice.children);
    const dismiss = content.querySelector<HTMLButtonElement>('[data-action="dismiss-message"]');
    if (dismiss) dismiss.textContent = '關閉這則提示';
    notice.classList.add('mobile-notice');
    notice.setAttribute('aria-atomic', 'true');
    const label = noticeLabel(message);
    const trigger = ui.detail('system-notice', label, [content], notice);
    trigger.classList.add('mobile-notice-trigger');
    trigger.setAttribute('aria-label', label);
    const symbol = document.createElement('span');
    symbol.className = 'mobile-notice-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = '!';
    trigger.prepend(symbol);

    // Existing game actions remove or replace the notice asynchronously after retry.
    // Clear only its presentation state and recover focus if its dialog disappeared.
    const observer = new MutationObserver(() => {
      if (notice.isConnected) return;
      observer.disconnect();
      ui.finish(root);
      if (root.querySelector('dialog[open]') || document.activeElement !== document.body) return;
      const target = [...root.querySelectorAll<HTMLElement>(
        '.pause-dialog button:not(:disabled), .tree-panel button:not(:disabled), .deploy-button, .page-intro h1, main h1',
      )].find(element => element.getClientRects().length > 0);
      if (target) {
        if (target.tagName === 'H1') target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    });
    observer.observe(root, { childList: true });
  }
}
