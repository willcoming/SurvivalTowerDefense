const SNAPSHOT = __OFFLINE_SNAPSHOT__;

// Each build is a complete immutable snapshot. Never activate an update early:
// the browser waits until every client of the preceding worker has closed.
const SCOPE = new URL(self.registration.scope);
const CACHE_NAME = `${SNAPSHOT.cachePrefix}${SNAPSHOT.buildId}`;
const MARKER_URL = new URL('__offline_complete__', SCOPE).href;
const ENTRIES = new Map(SNAPSHOT.entries.map((entry) => [new URL(entry.url, SCOPE).pathname, entry]));
const INDEX = ENTRIES.get(`${SNAPSHOT.base}index.html`);
let pending = null;
let completed = 0;
let bytesLoaded = 0;
let lastError;

function status(ready = false) {
  return {
    type: 'OFFLINE_STATUS', buildId: SNAPSHOT.buildId,
    completed, total: SNAPSHOT.entries.length,
    bytesLoaded, bytesTotal: SNAPSHOT.bytesTotal,
    ready, ...(lastError ? { error: lastError } : {}),
  };
}

function inScope(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}

async function broadcast(message) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) if (inScope(new URL(client.url))) client.postMessage(message);
  } catch {
    // A closing window must not turn a successful download into a failed install.
  }
}

function readableError(error) {
  if (error?.name === 'QuotaExceededError') return '儲存空間不足，請釋放裝置空間後重試下載。';
  if (error?.name === 'SecurityError') return '瀏覽器無法存取離線儲存空間，目前只能線上遊玩。';
  if (error?.code === 'INTEGRITY') return '遊戲檔案版本不一致，請稍後重試下載。';
  if (error?.code === 'INCOMPLETE') return '離線檔案不完整，請連網後重試下載。';
  if (error?.code === 'HTTP') return `遊戲檔案下載失敗（HTTP ${error.status}），請稍後重試。`;
  return '離線下載中斷，請確認網路連線後重試下載。';
}

async function matchesBytes(response, entry) {
  if (!response?.ok || response.type === 'opaque') return false;
  const body = await response.clone().arrayBuffer();
  if (body.byteLength !== entry.bytes) return false;
  const digest = await crypto.subtle.digest('SHA-256', body);
  const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return actual === entry.sha256;
}

async function download(entry) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(new URL(entry.url, SCOPE).href, {
      cache: 'no-store', credentials: 'same-origin', integrity: entry.integrity,
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error('HTTP'), { code: 'HTTP', status: response.status, path: entry.url });
    if (!(await matchesBytes(response, entry))) throw Object.assign(new Error('INTEGRITY'), { code: 'INTEGRITY' });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectSnapshot() {
  if (pending) return status(false);
  try {
    const cache = await caches.open(CACHE_NAME);
    const marker = await cache.match(MARKER_URL);
    let marked = false;
    try {
      const saved = marker && await marker.json();
      marked = saved?.buildId === SNAPSHOT.buildId && saved?.total === SNAPSHOT.entries.length && saved?.bytesTotal === SNAPSHOT.bytesTotal;
    } catch { /* A malformed marker cannot prove readiness. */ }
    const present = await Promise.all(SNAPSHOT.entries.map(async (entry) => {
      const response = await cache.match(new URL(entry.url, SCOPE).href);
      return response?.ok && response.type !== 'opaque';
    }));
    // An install or repair could have begun while these lookups were pending.
    if (pending) return status(false);
    completed = present.filter(Boolean).length;
    bytesLoaded = SNAPSHOT.entries.reduce((sum, entry, index) => sum + (present[index] ? entry.bytes : 0), 0);
    const ready = marked && completed === SNAPSHOT.entries.length;
    if (ready) lastError = undefined;
    else if (!lastError) lastError = '離線檔案不完整，請連網後重試下載。';
    return status(ready);
  } catch (error) {
    lastError = readableError(error);
    return status(false);
  }
}

async function prepareSnapshot() {
  let cache;
  completed = 0;
  bytesLoaded = 0;
  lastError = undefined;
  await broadcast(status(false));
  try {
    cache = await caches.open(CACHE_NAME);
    await cache.delete(MARKER_URL);
    let cursor = 0;
    let failure;
    // Bound memory, simultaneous downloads, and decompression on mobile devices.
    await Promise.all(Array.from({ length: Math.min(4, SNAPSHOT.entries.length) }, async () => {
      while (!failure && cursor < SNAPSHOT.entries.length) {
        const entry = SNAPSHOT.entries[cursor++];
        const url = new URL(entry.url, SCOPE).href;
        try {
          const cached = await cache.match(url);
          if (!(await matchesBytes(cached, entry))) await cache.put(url, await download(entry));
          completed++;
          bytesLoaded += entry.bytes;
          await broadcast(status(false));
        } catch (error) { failure ??= error; }
      }
    }));
    if (failure) throw failure;
    const present = await Promise.all(SNAPSHOT.entries.map((entry) => cache.match(new URL(entry.url, SCOPE).href)));
    if (present.some((response) => !response?.ok)) throw Object.assign(new Error('INCOMPLETE'), { code: 'INCOMPLETE' });
    // The marker is the final write; partial snapshots never count as installed.
    await cache.put(MARKER_URL, new Response(JSON.stringify({
      buildId: SNAPSHOT.buildId, total: SNAPSHOT.entries.length, bytesTotal: SNAPSHOT.bytesTotal,
    }), { headers: { 'Content-Type': 'application/json' } }));
    return status(true);
  } catch (error) {
    lastError = readableError(error);
    if (cache) await cache.delete(MARKER_URL).catch(() => {});
    await broadcast(status(false));
    throw error;
  }
}

function ensureSnapshot() {
  if (!pending) {
    pending = prepareSnapshot().then(async (result) => {
      pending = null;
      await broadcast(result);
      return result;
    }, (error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

self.addEventListener('install', (event) => {
  event.waitUntil(ensureSnapshot());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const result = await inspectSnapshot();
    if (!result.ready) {
      await broadcast(result);
      // Activation is irrevocable. If storage was evicted while waiting, retain
      // previous caches and report incomplete until the player repairs online.
      return;
    }
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(SNAPSHOT.cachePrefix) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await broadcast(result);
  })());
});

self.addEventListener('message', (event) => {
  if (!event.source?.url || !inScope(new URL(event.source.url))) return;
  if (event.data?.type !== 'OFFLINE_STATUS' && event.data?.type !== 'OFFLINE_REPAIR') return;
  event.waitUntil((async () => {
    let result;
    if (event.data.type === 'OFFLINE_REPAIR') {
      try { result = await ensureSnapshot(); }
      catch { result = await inspectSnapshot(); }
    } else result = await inspectSnapshot();
    const port = event.ports?.[0];
    if (port) { port.postMessage(result); port.close(); }
    else event.source.postMessage(result);
  })());
});

async function serveEntry(entry) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(entry.url, SCOPE).href;
  const cached = await cache.match(url);
  if (cached?.ok && cached.type !== 'opaque') return cached;
  await cache.delete(MARKER_URL);
  lastError = '離線檔案不完整，請連網後重試下載。';
  await broadcast(await inspectSnapshot());
  // A missing response can only be replaced by these exact build bytes. In
  // particular, never combine old application code with new public artwork.
  try {
    const response = await download(entry);
    await cache.put(url, response.clone());
    return response;
  } catch (error) {
    lastError = readableError(error);
    await broadcast(status(false));
    return new Response('離線檔案無法載入，請連網後重試下載。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!inScope(url)) return;
  // URL queries (including deployment revision links) share the verified asset.
  const entry = request.mode === 'navigate' ? INDEX : ENTRIES.get(url.pathname);
  if (entry) event.respondWith(serveEntry(entry));
});
