/** A top-layer reminder preserves the underlying page, dialogs and unconfirmed UI state. */
export class PortraitGuard {
  private dialog: HTMLDialogElement;
  constructor() {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'portrait-guard';
    this.dialog.setAttribute('aria-labelledby', 'portrait-guard-title');
    this.dialog.innerHTML = '<div><span aria-hidden="true">↻</span><h2 id="portrait-guard-title">請將手機轉回直向</h2><p>目前畫面與選擇會保留。戰鬥回到直向後，請手動繼續。</p></div>';
    this.dialog.addEventListener('cancel', event => event.preventDefault());
    document.body.append(this.dialog);
  }
  get active() { return this.dialog.open; }
  update() {
    const landscape = matchMedia('(pointer: coarse)').matches && innerWidth > innerHeight;
    if (landscape && !this.active) this.dialog.showModal();
    else if (!landscape && this.active) this.dialog.close();
  }
}
