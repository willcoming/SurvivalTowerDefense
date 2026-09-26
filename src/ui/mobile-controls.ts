/** Presentation state only: collection, combat and persistence stay in GameApp. */
export class MobileControls {
  private selections = new Map<string, number>();
  private selectedItems = new Map<string, string>();
  private openDetail: string | null = null;
  private page = '';
  private suspended = false;
  private detailFocus: HTMLElement | null = null;
  selectTab(key: string, index: number) { this.selections.set(key, index); }
  suspendDetails(trigger: HTMLElement | null = null) {
    this.suspended = !!document.querySelector('dialog.mobile-detail[open]');
    this.detailFocus = this.suspended ? trigger ?? document.activeElement as HTMLElement : null;
    document.querySelectorAll<HTMLDialogElement>('dialog.mobile-detail[open]').forEach(dialog => dialog.close());
  }
  resumeDetails() {
    if (!this.suspended) return;
    this.suspended = false;
    const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog.mobile-detail')].find(d => d.dataset.detail === this.openDetail);
    dialog?.showModal();
    if (this.detailFocus?.isConnected) this.detailFocus.focus({ preventScroll: true });
    this.detailFocus = null;
  }

  begin(page: string) {
    if (page !== this.page) { this.openDetail = null; this.suspended = false; }
    this.page = page;
  }

  finish(root: HTMLElement) {
    if (!this.suspended && !root.querySelector('dialog.mobile-detail[open]')) this.openDetail = null;
  }

  dismissDetails() {
    this.openDetail = null;
    document.querySelectorAll<HTMLDialogElement>('dialog.mobile-detail[open]').forEach(dialog => dialog.close());
  }

  detail(key: string, label: string, nodes: HTMLElement[], mount: HTMLElement, actions: HTMLElement[] = []): HTMLButtonElement {
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
    if (actions.length) {
      const footer = document.createElement('footer');
      footer.className = 'mobile-detail-actions';
      footer.append(...actions);
      dialog.append(footer);
    }
    mount.append(trigger, dialog);
    const dismiss = () => {
      if (this.openDetail === key) this.openDetail = null;
      dialog.close();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
    close.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    trigger.addEventListener('click', () => { this.openDetail = key; dialog.showModal(); });
    if (this.openDetail === key && !this.suspended) dialog.showModal();
    return trigger;
  }

  pager(key: string, items: HTMLElement[], labels: string[], mount: HTMLElement, initialIndex = 0, pageSize = 1): HTMLSelectElement {
    const label = document.createElement('div');
    label.className = 'mobile-pager';
    const caption = document.createElement('span');
    caption.textContent = mount.dataset.label ?? '切換內容';
    const select = document.createElement('select');
    select.setAttribute('aria-label', caption.textContent);
    const pages = Math.ceil(items.length / pageSize);
    const identity = (i: number) => items[i]?.dataset.mobileKey ?? items[i]?.dataset.id ?? labels[i];
    for (let page = 0; page < pages; page++) {
      const start = page * pageSize;
      select.add(new Option(pageSize === 1 ? labels[start] : `${page + 1} / ${pages} · ${labels[start]}${labels[start + pageSize - 1] ? ` — ${labels[start + pageSize - 1]}` : ''}`, String(page)));
    }
    const previous = document.createElement('button');
    const next = document.createElement('button');
    for (const button of [previous, next]) { button.type = 'button'; button.className = 'mobile-pager-step'; }
    previous.textContent = '‹'; next.textContent = '›';
    previous.setAttribute('aria-label', `上一個${caption.textContent}`);
    next.setAttribute('aria-label', `下一個${caption.textContent}`);
    const show = (index: number) => {
      items.forEach((item, i) => { item.hidden = Math.floor(i / pageSize) !== index; });
      select.value = String(index);
      this.selectedItems.set(key, identity(index * pageSize));
      previous.disabled = index === 0;
      next.disabled = index === pages - 1;
    };
    const remembered = items.findIndex((_, i) => identity(i) === this.selectedItems.get(key));
    show(Math.max(0, Math.min(pages - 1, Math.floor((remembered >= 0 ? remembered : initialIndex) / pageSize))));
    select.addEventListener('change', () => show(Number(select.value)));
    previous.addEventListener('click', () => show(Math.max(0, Number(select.value) - 1)));
    next.addEventListener('click', () => show(Math.min(pages - 1, Number(select.value) + 1)));
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
