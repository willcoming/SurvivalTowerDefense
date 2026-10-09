import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Replace a production worker left on the development origin with a network-only worker. */
export function developmentWorker(base: string): string {
  const prefix = `starfall-offline-${createHash('sha256').update(base).digest('hex').slice(0, 16)}-`;
  return `// Development only. No fetch handler: every request goes to Vite.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  try {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(${JSON.stringify(prefix)})).map(name => caches.delete(name)));
  } catch (_) { /* A blocked cache API must not keep the old worker in control. */ }
  await self.registration.unregister();
  const scope = new URL(self.registration.scope);
  const clients = await self.clients.matchAll({ type: 'window' });
  await Promise.all(clients.filter(client => {
    const url = new URL(client.url);
    return url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  }).map(client => client.navigate(client.url).catch(() => {})));
})()));
`;
}

export function developmentOfflinePlugin(): Plugin {
  return {
    name: 'starfall-retire-development-offline-worker',
    apply: 'serve',
    configureServer(server) {
      const base = server.config.base;
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== `${base}sw.js`) return next();
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(developmentWorker(base));
      });
    },
  };
}
