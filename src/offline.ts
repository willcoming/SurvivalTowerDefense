/** Page-side PWA lifecycle. Readiness always belongs to the worker controlling this page. */
export interface OfflineStatus {
  type: 'OFFLINE_STATUS';
  buildId: string;
  completed: number;
  total: number;
  bytesLoaded: number;
  bytesTotal: number;
  ready: boolean;
  error?: string;
}
export interface OfflineState {
  phase: 'checking' | 'downloading' | 'downloaded' | 'ready' | 'error' | 'unsupported' | 'development';
  update: 'none' | 'downloading' | 'waiting' | 'error';
  progress?: OfflineStatus;
  error: string;
  online: boolean;
  busy: boolean;
  install: 'available' | 'standalone' | 'installed' | 'ios' | 'manual';
  installBusy: boolean;
  installMessage: string;
}
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const complete = (status?: OfflineStatus) => !!status?.ready && status.total > 0 && status.completed === status.total;
const message = (error: unknown) => {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/quota/i.test(detail)) return '儲存空間不足，請釋放裝置空間後重試下載。';
  if (/security|denied|permission|not allowed|insecure|invalidstate/i.test(detail)) return '此瀏覽器目前未允許離線儲存，可繼續線上遊玩。請檢查瀏覽器的網站儲存設定後重試。';
  return /[\u3400-\u9fff]/.test(detail) ? detail.replace(/^Error: /, '') : '無法完成離線下載，請確認網路連線後重試。';
};
const validStatus = (value: unknown): value is OfflineStatus => {
  if (!value || typeof value !== 'object') return false;
  const data = value as OfflineStatus;
  return data.type === 'OFFLINE_STATUS' && typeof data.buildId === 'string' && typeof data.ready === 'boolean' &&
    ['completed', 'total', 'bytesLoaded', 'bytesTotal'].every(key => Number.isFinite(data[key as keyof OfflineStatus]) && Number(data[key as keyof OfflineStatus]) >= 0);
};

class OfflineGame {
  private listeners = new Set<() => void>();
  private container: ServiceWorkerContainer | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private candidate: ServiceWorker | null = null;
  private statuses = new Map<ServiceWorker, OfflineStatus>();
  private watched = new Set<ServiceWorker>();
  private requests = new Map<ServiceWorker, Promise<void>>();
  private started = false;
  private unsupported = false;
  private busy = false;
  private online = true;
  private failure = '';
  private promptEvent: InstallPrompt | null = null;
  private installBusy = false;
  private installMessage = '';
  private installed = false;
  private standalone = false;
  private ios = false;
  private scope = '';
  private script = '';

  get state(): OfflineState {
    const controller = this.controller;
    const current = controller ? this.statuses.get(controller) : undefined;
    const uncontrolled = !controller && this.registration?.active ? this.statuses.get(this.registration.active) : undefined;
    const nextWorker = this.registration?.installing ?? this.registration?.waiting ?? this.candidate;
    const next = nextWorker && nextWorker !== controller ? this.statuses.get(nextWorker) : undefined;
    const error = next?.error || this.failure || current?.error || uncontrolled?.error || '';
    const ready = complete(current);
    const downloading = nextWorker?.state === 'installing' || !!(current && !current.ready && !current.error && this.busy);
    const waiting = !!this.registration?.waiting && complete(next);
    return {
      phase: !import.meta.env.PROD ? 'development' : this.unsupported ? 'unsupported' : ready ? 'ready' :
        error ? 'error' : complete(uncontrolled) ? 'downloaded' : downloading || (current && !current.ready && !current.error) ? 'downloading' : 'checking',
      update: ready ? waiting ? 'waiting' : error ? 'error' : downloading ? 'downloading' : 'none' : 'none',
      progress: ready ? next ?? current : current ?? next ?? uncontrolled, error, online: this.online, busy: this.busy || downloading,
      install: this.standalone ? 'standalone' : this.installed ? 'installed' : this.promptEvent ? 'available' : this.ios ? 'ios' : 'manual',
      installBusy: this.installBusy, installMessage: this.installMessage,
    };
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit() { for (const listener of this.listeners) listener(); }
  private get controller() {
    const worker = this.container?.controller;
    return worker?.scriptURL === this.script ? worker : null;
  }
  async start() {
    if (this.started) return;
    this.started = true;
    this.online = navigator.onLine;
    const display = matchMedia('(display-mode: standalone)');
    this.standalone = display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    display.addEventListener('change', () => { this.standalone = display.matches; this.emit(); });
    window.addEventListener('beforeinstallprompt', event => {
      if (!import.meta.env.PROD) return;
      event.preventDefault(); this.promptEvent = event as InstallPrompt; this.installMessage = ''; this.emit();
    });
    window.addEventListener('appinstalled', () => { this.installed = true; this.promptEvent = null; this.emit(); });
    if (!import.meta.env.PROD) { this.emit(); return; }
    window.addEventListener('online', () => { this.online = true; this.emit(); void this.retry(); });
    window.addEventListener('offline', () => { this.online = false; this.emit(); });
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
      this.unsupported = true; this.emit(); return;
    }
    this.scope = new URL(import.meta.env.BASE_URL, location.href).href;
    this.script = new URL('sw.js', this.scope).href;
    try {
      this.container = navigator.serviceWorker;
      this.container.addEventListener('controllerchange', () => { this.watch(this.controller); void this.refresh(); });
      this.container.addEventListener('message', event => {
        const worker = event.source as ServiceWorker | null;
        if (worker && this.watched.has(worker) && validStatus(event.data)) {
          this.statuses.set(worker, event.data); this.emit();
        }
      });
      const existing = await this.container.getRegistration(this.scope);
      if (existing?.scope === this.scope) this.bind(existing);
      await this.refresh();
      if (this.online || !this.registration) await this.register();
    } catch (error) { this.unsupported = !this.container; this.failure = message(error); this.emit(); }
  }
  private bind(registration: ServiceWorkerRegistration) {
    if (this.registration !== registration) {
      this.registration = registration;
      registration.addEventListener('updatefound', () => {
        this.failure = ''; this.candidate = registration.installing; this.watch(this.candidate); this.emit();
      });
    }
    this.candidate = registration.installing ?? registration.waiting;
    this.watch(this.controller); this.watch(registration.active); this.watch(this.candidate);
  }
  private watch(worker: ServiceWorker | null) {
    if (!worker || this.watched.has(worker)) return;
    this.watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant' && worker === this.candidate && worker !== this.controller) {
        this.failure = this.statuses.get(worker)?.error || '離線下載未完成，請確認連線後重試。';
      }
      this.watch(this.controller); void this.refresh(); this.emit();
    });
    void this.query(worker);
  }
  private async query(worker: ServiceWorker) {
    if (worker.state === 'redundant') return;
    const pending = this.requests.get(worker); if (pending) return pending;
    const request = new Promise<void>(resolve => {
      const channel = new MessageChannel();
      const finish = () => { clearTimeout(timer); channel.port1.close(); resolve(); };
      const timer = setTimeout(() => {
        if (worker.state !== 'redundant' && [this.controller, this.registration?.active, this.candidate].includes(worker) && !this.statuses.has(worker)) { this.failure = '無法確認離線下載狀態，請重試。'; this.emit(); }
        finish();
      }, 8000);
      channel.port1.onmessage = event => {
        if (validStatus(event.data)) {
          this.statuses.set(worker, event.data);
          if (this.failure === '無法確認離線下載狀態，請重試。') this.failure = '';
          this.emit();
        }
        finish();
      };
      try { worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]); }
      catch (error) {
        if ([this.controller, this.registration?.active, this.candidate].includes(worker) && !this.statuses.has(worker)) { this.failure = message(error); this.emit(); }
        finish();
      }
    });
    this.requests.set(worker, request);
    await request; this.requests.delete(worker);
  }
  private async refresh() {
    this.watch(this.controller);
    const workers = new Set([this.controller, this.registration?.active, this.registration?.installing, this.registration?.waiting]);
    await Promise.all([...workers].filter((worker): worker is ServiceWorker => !!worker).map(worker => this.query(worker)));
    this.emit();
  }
  private async register() {
    if (!this.container) return;
    this.bind(await this.container.register(this.script, { scope: this.scope, updateViaCache: 'none' }));
    await this.refresh();
  }
  async retry() {
    if (!import.meta.env.PROD || this.unsupported || this.busy) return;
    this.busy = true; this.failure = ''; this.emit();
    try {
      const active = this.controller ?? this.registration?.active;
      if (active?.state === 'activated' && !complete(this.statuses.get(active))) {
        // The repair has its own worker lifetime; broadcasts update only these dedicated UI nodes.
        await new Promise<void>((resolve, reject) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => { channel.port1.close(); reject(new Error('下載尚未完成，請確認連線與可用空間後重試。')); }, 120000);
          channel.port1.onmessage = event => {
            if (validStatus(event.data)) this.statuses.set(active, event.data);
            clearTimeout(timer); channel.port1.close(); resolve();
          };
          active.postMessage({ type: 'OFFLINE_REPAIR' }, [channel.port2]);
        });
      }
      if (!this.registration?.active && !this.registration?.installing) await this.register();
      else if (this.registration && this.online) await this.registration.update();
      await this.refresh();
    } catch (error) { this.failure = message(error); }
    finally { this.busy = false; this.emit(); }
  }
  async install() {
    const prompt = this.promptEvent; if (!prompt || this.installBusy) return;
    this.promptEvent = null; this.installBusy = true; this.installMessage = ''; this.emit();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      this.installMessage = choice.outcome === 'accepted' ? '安裝後請開啟遊戲，確認顯示「可離線遊玩」。' : '已取消安裝；仍可在此瀏覽器遊玩。';
    } catch { this.installMessage = '暫時無法開啟安裝提示，請使用瀏覽器選單加入主畫面。'; }
    finally { this.installBusy = false; this.emit(); }
  }
}
export const offlineGame = new OfflineGame();
