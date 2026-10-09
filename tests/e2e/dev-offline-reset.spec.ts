import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { developmentWorker } from '../../scripts/dev-offline';

test('switching production preview to development retires old offline UI and preserves saves', async ({ page }) => {
  const prefix = `starfall-offline-${createHash('sha256').update('/').digest('hex').slice(0,16)}-`;
  const oldHtml = '<h1>Old cached page</h1><script>navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"});</script>';
  const oldWorker = `
    self.addEventListener('install', e => e.waitUntil((async () => {
      await (await caches.open('${prefix}old')).put('/', new Response(${JSON.stringify(oldHtml)}, {headers:{'Content-Type':'text/html'}}));
      await self.skipWaiting();
    })()));
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', e => { if(e.request.mode==='navigate') e.respondWith(caches.match('/')); });
  `;
  let development = false;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/sw.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(development ? developmentWorker('/') : oldWorker); }
    else { response.setHeader('Content-Type', 'text/html'); response.end(development ? '<h1>Current development page</h1>' : oldHtml); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.evaluate(async () => {
      localStorage.setItem('save-check', 'keep-progress');
      await (await caches.open('unrelated-application')).put('/keep', new Response('keep'));
      await new Promise<void>((resolve,reject) => {
        const open=indexedDB.open('saved-progress',1);
        open.onupgradeneeded=()=>open.result.createObjectStore('save');
        open.onerror=()=>reject(open.error);
        open.onsuccess=()=>{const db=open.result,tx=db.transaction('save','readwrite');tx.objectStore('save').put({level:8},'progress');tx.oncomplete=()=>{db.close();resolve();};};
      });
    });
    await page.reload();await expect(page.getByRole('heading')).toHaveText('Old cached page');
    development = true;
    await page.reload();
    await expect(page.getByRole('heading')).toHaveText('Current development page');
    for(let i=0;i<3;i++){await page.reload();await expect(page.getByRole('heading')).toHaveText('Current development page');}
    const state=await page.evaluate(async () => ({
      registrations:(await navigator.serviceWorker.getRegistrations()).length,
      controlled:!!navigator.serviceWorker.controller,
      caches:await caches.keys(),save:localStorage.getItem('save-check'),
      progress:await new Promise<unknown>((resolve,reject)=>{const open=indexedDB.open('saved-progress',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,request=db.transaction('save').objectStore('save').get('progress');request.onsuccess=()=>{db.close();resolve(request.result);};};}),
    }));
    expect(state).toEqual({registrations:0,controlled:false,caches:['unrelated-application'],save:'keep-progress',progress:{level:8}});
  } finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
});
