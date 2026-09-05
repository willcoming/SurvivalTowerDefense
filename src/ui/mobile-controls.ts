/** Presentation state only: collection, combat and persistence stay in GameApp. */
export class MobileControls {
  private selections = new Map<string, number>();
  private openDetail: string | null = null;
  private page = '';

  begin(page: string) {
    if (page !== this.page) this.openDetail = null;
    this.page = page;
  }

  finish(root: HTMLElement) {
    if (!root.querySelector('dialog.mobile-detail[open]')) this.openDetail = null;
  }

  detail(key: string, label: string, nodes: HTMLElement[], mount: HTMLElement): HTMLButtonElement {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'button secondary mobile-detail-trigger';
    trigger.textContent = label;
    trigger.setAttribute('aria-haspopup', 'dialog');
    const dialog = document.createElement('dialog');
    dialog.className = 'mobile-detail';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', label);
    dialog.dataset.detail = key;
    const header = document.createElement('header');
    header.className = 'mobile-detail-header';
    const title = document.createElement('h2');
    title.textContent = label;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button';
    close.textContent = '×';
    close.setAttribute('aria-label', '關閉詳細資訊');
    header.append(title, close);
    const body = document.createElement('div');
    body.className = 'mobile-detail-body';
    body.append(...nodes);
    dialog.append(header, body);
    mount.append(trigger, dialog);
    const dismiss = () => {
      if (this.openDetail === key) this.openDetail = null;
      dialog.close();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
    close.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    trigger.addEventListener('click', () => { this.openDetail = key; dialog.showModal(); });
    if (this.openDetail === key) dialog.showModal();
    return trigger;
  }

  pager(key: string, items: HTMLElement[], labels: string[], mount: HTMLElement, initialIndex = 0): HTMLSelectElement {
    const label = document.createElement('div');
    label.className = 'mobile-pager';
    const caption = document.createElement('span');
    caption.textContent = mount.dataset.label ?? '切換內容';
    const select = document.createElement('select');
    select.setAttribute('aria-label', caption.textContent);
    labels.forEach((text, i) => select.add(new Option(text, String(i))));
    const previous = document.createElement('button');
    const next = document.createElement('button');
    for (const button of [previous, next]) { button.type = 'button'; button.className = 'mobile-pager-step'; }
    previous.textContent = '‹'; next.textContent = '›';
    previous.setAttribute('aria-label', `上一個${caption.textContent}`);
    next.setAttribute('aria-label', `下一個${caption.textContent}`);
    const show = (index: number) => {
      items.forEach((item, i) => { item.hidden = i !== index; });
      select.value = String(index);
      this.selections.set(key, index);
      previous.disabled = index === 0;
      next.disabled = index === items.length - 1;
    };
    show(Math.max(0, Math.min(items.length - 1, this.selections.get(key) ?? initialIndex)));
    select.addEventListener('change', () => show(Number(select.value)));
    previous.addEventListener('click', () => show(Math.max(0, Number(select.value) - 1)));
    next.addEventListener('click', () => show(Math.min(items.length - 1, Number(select.value) + 1)));
    label.append(caption, previous, select, next);
    mount.append(label);
    return select;
  }

  tabs(key: string, panels: HTMLElement[], labels: string[], mount: HTMLElement): void {
    const group = document.createElement('div');
    group.className = 'mobile-tabs';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', mount.dataset.label ?? '切換內容');
    const show = (index: number) => {
      panels.forEach((panel, i) => { panel.hidden = i !== index; });
      [...group.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      this.selections.set(key, index);
    };
    labels.forEach((label, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => show(i));
      group.append(button);
    });
    mount.append(group);
    show(Math.max(0, Math.min(panels.length - 1, this.selections.get(key) ?? 0)));
  }

  handleKey(event: KeyboardEvent): boolean {
    const dialog = document.querySelector<HTMLDialogElement>('dialog.mobile-detail[open]');
    if (!dialog) return false;
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]')]
        .filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    // Escape is handled by the dialog's native cancel event, not battle pause.
    return true;
  }
}
