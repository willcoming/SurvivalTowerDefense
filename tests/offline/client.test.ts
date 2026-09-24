import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OfflineStatus } from '../../src/offline';

const scope = 'https://game.example/SurvivalTowerDefense/';
const full = (buildId = 'version-a'): OfflineStatus => ({
  type: 'OFFLINE_STATUS', buildId, completed: 4, total: 4,
  bytesLoaded: 400, bytesTotal: 400, ready: true,
});
const partial = (buildId = 'version-a'): OfflineStatus => ({
  ...full(buildId), completed: 1, bytesLoaded: 100, ready: false,
});

/** The transport stays asynchronous, matching real worker messages without leaking native ports. */
class TestPort {
  other!: TestPort;
  closed = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage(data: unknown) {
    queueMicrotask(() => { if (!this.other.closed) this.other.onmessage?.({ data }); });
  }
  close() { this.closed = true; }
}
class TestChannel {
  port1 = new TestPort();
  port2 = new TestPort();
  constructor() { this.port1.other = this.port2; this.port2.other = this.port1; }
}
class TestWorker extends EventTarget {
  scriptURL = `${scope}sw.js`;
  postMessage = vi.fn((_request: { type: string }, ports: TestPort[]) => {
    if (this.status) ports[0].postMessage(this.status);
  });
  constructor(public state: ServiceWorkerState, public status?: OfflineStatus) { super(); }
  transition(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
class TestRegistration extends EventTarget {
  scope = scope;
  active: TestWorker | null = null;
  installing: TestWorker | null = null;
  waiting: TestWorker | null = null;
  update = vi.fn(async () => undefined);
  constructor(worker?: TestWorker) { super(); this.active = worker ?? null; }
}
class TestContainer extends EventTarget {
  controller: TestWorker | null = null;
  getRegistration = vi.fn(async (): Promise<TestRegistration | undefined> => undefined);
  register = vi.fn(async () => this.registration);
  constructor(public registration: TestRegistration) { super(); }
  broadcast(worker: TestWorker) {
    this.dispatchEvent(Object.assign(new Event('message'), { source: worker, data: worker.status }));
  }
  control(worker: TestWorker) { this.controller = worker; this.dispatchEvent(new Event('controllerchange')); }
}
function environment(registration = new TestRegistration()) {
  const container = new TestContainer(registration);
  const browser = Object.assign(new EventTarget(), { isSecureContext: true, caches: {} });
  const navigator = { onLine: true, userAgent: 'Test Browser', platform: 'MacIntel', maxTouchPoints: 0, serviceWorker: container };
  vi.stubGlobal('window', browser);
  vi.stubGlobal('navigator', navigator);
  vi.stubGlobal('location', { href: scope, reload: vi.fn() });
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }));
  vi.stubGlobal('MessageChannel', TestChannel);
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/SurvivalTowerDefense/');
  vi.resetModules();
  return { container, browser, navigator, registration };
}
async function client() { return (await import('../../src/offline')).offlineGame; }
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('offline page controller', () => {
  it('repairs and reloads the current version only after the save completes', async () => {
    const active = new TestWorker('activated', full());
    const { container, registration } = environment(new TestRegistration(active));
    container.controller = active;
    const game = await client(); await game.start();
    const save = vi.fn(async () => { expect(location.reload).not.toHaveBeenCalled(); });
    await game.forceUpdate(save);
    expect(registration.update).toHaveBeenCalledOnce();
    expect(active.postMessage.mock.calls.some(([request]) => request.type === 'OFFLINE_REPAIR')).toBe(true);
    expect(save).toHaveBeenCalledOnce(); expect(location.reload).toHaveBeenCalledOnce();
  });

  it('activates a complete waiting update explicitly, then reloads with the new controller', async () => {
    const active = new TestWorker('activated', full());
    const next = new TestWorker('installed', full('version-b'));
    const registration = new TestRegistration(active); registration.waiting = next;
    const { container } = environment(registration); container.controller = active;
    const save = vi.fn(async () => {});
    next.postMessage.mockImplementation((request, ports) => {
      if (request.type === 'OFFLINE_ACTIVATE') {
        expect(save).toHaveBeenCalledOnce();
        registration.waiting = null; registration.active = next;
        next.transition('activated'); container.control(next);
      }
      ports[0].postMessage(next.status);
    });
    const game = await client(); await game.start();
    expect(next.postMessage.mock.calls.every(([request]) => request.type === 'OFFLINE_STATUS')).toBe(true);
    await game.forceUpdate(save);
    expect(next.postMessage).toHaveBeenCalledWith({ type: 'OFFLINE_ACTIVATE', previousBuildId: 'version-a' }, expect.any(Array));
    expect(container.controller).toBe(next); expect(location.reload).toHaveBeenCalledOnce();
  });

  it('keeps the page open on save conflict, offline connection, or failed network update', async () => {
    const active = new TestWorker('activated', full());
    const { container, registration, browser } = environment(new TestRegistration(active)); container.controller = active;
    const game = await client(); await game.start();
    await game.forceUpdate(async () => { throw new Error('存檔尚未完成'); });
    expect(game.state.forceMessage).toContain('存檔尚未完成');
    expect(location.reload).not.toHaveBeenCalled();
    registration.update.mockRejectedValueOnce(new TypeError('Network failure'));
    const save = vi.fn(async () => {}); await game.forceUpdate(save);
    expect(game.state.forceMessage).toContain('目前版本與存檔已保留');
    browser.dispatchEvent(new Event('offline'));
    await game.forceUpdate(save);
    expect(game.state.forceMessage).toContain('沒有網路');
    expect(save).not.toHaveBeenCalled(); expect(location.reload).not.toHaveBeenCalled();
  });

  it('waits for installation and prevents duplicate force-update requests', async () => {
    const active = new TestWorker('activated', full());
    const next = new TestWorker('installing', partial('version-b'));
    const { container, registration } = environment(new TestRegistration(active)); container.controller = active;
    registration.installing = next;
    const game = await client(); await game.start();
    const save = vi.fn(async () => {});
    const pending = game.forceUpdate(save); await settle();
    await game.forceUpdate(save);
    expect(game.state.forceBusy).toBe(true); expect(registration.update).toHaveBeenCalledOnce();
    next.transition('redundant'); await pending;
    expect(game.state.forceMessage).toContain('新版下載未完成');
    expect(game.state.forceBusy).toBe(false);
    expect(save).not.toHaveBeenCalled(); expect(location.reload).not.toHaveBeenCalled();
  });

  it('re-registers after a failed first install and waits for control before reporting ready', async () => {
    const registration = new TestRegistration();
    const failed = new TestWorker('installing', partial());
    registration.installing = failed;
    const { container } = environment(registration);
    const game = await client();
    await game.start();
    expect(game.state.phase).toBe('downloading');
    expect(container.register).toHaveBeenCalledWith(`${scope}sw.js`, { scope, updateViaCache: 'none' });

    failed.status = { ...partial(), error: '儲存空間不足，請釋放裝置空間後重試下載。' };
    container.broadcast(failed);
    registration.installing = null;
    failed.transition('redundant');
    await settle();
    expect(game.state.phase).toBe('error');
    expect(game.state.busy).toBe(false);

    const replacement = new TestWorker('installing', partial());
    container.register.mockImplementationOnce(async () => {
      registration.installing = replacement;
      registration.dispatchEvent(new Event('updatefound'));
      return registration;
    });
    await game.retry();
    expect(container.register).toHaveBeenCalledTimes(2);
    expect(registration.update).not.toHaveBeenCalled();
    expect(game.state.phase).toBe('downloading');
    replacement.status = full();
    container.broadcast(replacement);
    expect(game.state.phase).not.toBe('ready');

    registration.installing = null;
    registration.active = replacement;
    replacement.transition('activated');
    container.control(replacement);
    await settle();
    expect(game.state).toMatchObject({ phase: 'ready', update: 'none', error: '' });
  });

  it('preserves the usable version when an update fails and ignores stale worker messages after a later activation', async () => {
    const current = new TestWorker('activated', full());
    const registration = new TestRegistration(current);
    const { container } = environment(registration);
    container.controller = current;
    container.getRegistration.mockResolvedValue(registration);
    const game = await client();
    await game.start();
    expect(game.state.phase).toBe('ready');

    const update = new TestWorker('installing', partial('version-b'));
    registration.installing = update;
    registration.dispatchEvent(new Event('updatefound'));
    await settle();
    expect(game.state).toMatchObject({ phase: 'ready', update: 'downloading' });
    update.status = { ...partial('version-b'), error: '下載中斷，請重新連線後重試。' };
    container.broadcast(update);
    registration.installing = null;
    update.transition('redundant');
    await settle();
    expect(game.state).toMatchObject({ phase: 'ready', update: 'error' });
    expect(container.controller).toBe(current);

    const recovered = new TestWorker('installing', partial('version-b'));
    registration.installing = recovered;
    registration.dispatchEvent(new Event('updatefound'));
    await settle();
    recovered.status = full('version-b');
    registration.installing = null;
    registration.waiting = recovered;
    recovered.transition('installed');
    await settle();
    expect(game.state).toMatchObject({ phase: 'ready', update: 'waiting' });
    expect(container.controller).toBe(current);
    expect(recovered.postMessage.mock.calls.every(([request]) => request.type === 'OFFLINE_STATUS')).toBe(true);

    registration.waiting = null;
    registration.active = recovered;
    recovered.transition('activated');
    container.control(recovered);
    await settle();
    current.status = { ...partial(), error: '舊版已移除' };
    container.broadcast(current);
    container.broadcast(update);
    expect(game.state).toMatchObject({ phase: 'ready', update: 'none', error: '' });
    expect(game.state.progress?.buildId).toBe('version-b');
  });

  it('does not claim offline readiness from an installed worker that does not control this page', async () => {
    const waiting = new TestWorker('installed', full());
    const registration = new TestRegistration();
    registration.waiting = waiting;
    const { container } = environment(registration);
    const game = await client();
    await game.start();
    expect(game.state.phase).not.toBe('ready');
    expect(container.controller).toBeNull();
  });

  it('offers a truthful downloaded state after a hard reload bypasses an already complete active worker', async () => {
    const active = new TestWorker('activated', full());
    const registration = new TestRegistration(active);
    const { container } = environment(registration);
    container.getRegistration.mockResolvedValue(registration);
    const game = await client();
    await game.start();
    expect(container.controller).toBeNull();
    expect(game.state).toMatchObject({ phase: 'downloaded', update: 'none', error: '' });
    expect(game.state.progress?.ready).toBe(true);
    expect(active.postMessage.mock.calls.every(([request]) => request.type === 'OFFLINE_STATUS')).toBe(true);
    container.control(active);
    await settle();
    expect(game.state.phase).toBe('ready');
  });

  it('keeps development and insecure environments online-only without registering', async () => {
    const { container, browser } = environment();
    vi.stubEnv('PROD', false);
    const development = await client();
    await development.start();
    expect(development.state.phase).toBe('development');
    expect(container.register).not.toHaveBeenCalled();
    vi.stubEnv('PROD', true);
    browser.isSecureContext = false;
    vi.resetModules();
    const insecure = await client();
    await insecure.start();
    await insecure.retry();
    expect(insecure.state.phase).toBe('unsupported');
    expect(container.register).not.toHaveBeenCalled();
  });

  it('reports denied storage in Chinese while allowing a registration retry', async () => {
    const { container } = environment();
    container.register.mockRejectedValueOnce(new DOMException('User denied permission', 'SecurityError'));
    const game = await client();
    await game.start();
    expect(game.state.phase).toBe('error');
    expect(game.state.error).toContain('可繼續線上遊玩');
    expect(game.state.error).not.toContain('SecurityError');
    await game.retry();
    expect(container.register).toHaveBeenCalledTimes(2);
    expect(game.state.error).toBe('');
  });

  it('handles browsers that throw on service worker access without rejecting game startup', async () => {
    const { navigator, container } = environment();
    Object.defineProperty(navigator, 'serviceWorker', { get() { throw new DOMException('Access denied', 'SecurityError'); } });
    const game = await client();
    await expect(game.start()).resolves.toBeUndefined();
    expect(game.state.phase).toBe('unsupported');
    expect(game.state.error).toContain('可繼續線上遊玩');
    expect(container.register).not.toHaveBeenCalled();
  });

  it('makes an unanswered status query retryable and can recover by repairing the active cache', async () => {
    vi.useFakeTimers();
    const active = new TestWorker('activated');
    const registration = new TestRegistration(active);
    const { container } = environment(registration);
    container.controller = active;
    container.getRegistration.mockResolvedValue(registration);
    const game = await client();
    const starting = game.start();
    await settle();
    await vi.runAllTimersAsync();
    await starting;
    expect(game.state.phase).toBe('error');
    expect(game.state.error).toContain('無法確認離線下載狀態');
    active.status = full();
    await game.retry();
    expect(active.postMessage.mock.calls.some(([request]) => request.type === 'OFFLINE_REPAIR')).toBe(true);
    expect(game.state).toMatchObject({ phase: 'ready', update: 'none', error: '' });
  });

  it.each(['accepted', 'dismissed'] as const)('handles an %s install prompt only after the user invokes install', async outcome => {
    const { browser } = environment();
    const game = await client();
    await game.start();
    const prompt = vi.fn(async () => undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt, userChoice: Promise.resolve({ outcome }),
    });
    browser.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(game.state.install).toBe('available');
    expect(prompt).not.toHaveBeenCalled();
    await game.install();
    await game.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(game.state.installBusy).toBe(false);
    expect(game.state.installMessage).toContain(outcome === 'accepted' ? '確認顯示「可離線遊玩」' : '已取消安裝');
    expect(game.state.phase).not.toBe('ready');
    if (outcome === 'accepted') {
      browser.dispatchEvent(new Event('appinstalled'));
      expect(game.state.install).toBe('installed');
      expect(game.state.phase).not.toBe('ready');
    }
  });
});
