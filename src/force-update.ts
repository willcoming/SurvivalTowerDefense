/** Wait for a complete worker; a failed download never replaces the usable version. */
function installed(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer); worker.removeEventListener('statechange', check);
      if (error) reject(error); else resolve();
    };
    const check = () => {
      if (worker.state === 'redundant') finish(new Error('新版下載未完成，請確認連線後重試。'));
      else if (worker.state !== 'installing') finish();
    };
    const timer = setTimeout(() => finish(new Error('更新下載逾時，請稍後重試。')), 120000);
    worker.addEventListener('statechange', check); check();
  });
}
function request(worker: ServiceWorker, type: string, previousBuildId?: string) {
  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      clearTimeout(timer); channel.port1.close();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('更新未完成，請保持連線後重試。')), 120000);
    channel.port1.onmessage = ({ data }) => finish(data?.ready && data.completed === data.total && data.total > 0
      ? undefined : new Error(data?.error || '遊戲檔案未下載完整，請重試更新。'));
    try { worker.postMessage({ type, previousBuildId }, [channel.port2]); }
    catch { finish(new Error('無法套用更新，請稍後重試。')); }
  });
}
async function controlled(container: ServiceWorkerContainer, worker: ServiceWorker) {
  if (container.controller === worker) return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer); container.removeEventListener('controllerchange', check);
      if (error) reject(error); else resolve();
    };
    const check = () => { if (container.controller === worker) finish(); };
    const timer = setTimeout(() => finish(new Error('更新尚未接管此頁，請稍後重試。')), 15000);
    container.addEventListener('controllerchange', check); check();
  });
}

export async function forceUpdate(
  container: ServiceWorkerContainer, registration: ServiceWorkerRegistration,
  beforeReload: () => Promise<void>, previousBuildId?: string,
) {
  await registration.update();
  if (registration.installing) await installed(registration.installing);
  const worker = registration.waiting ?? registration.active;
  if (!worker) throw new Error('尚未完成遊戲下載，請稍後重試。');
  await request(worker, 'OFFLINE_REPAIR');
  // Save at the end of the download, also rechecking that a battle hasn't started.
  await beforeReload();
  if (registration.waiting === worker) await request(worker, 'OFFLINE_ACTIVATE', previousBuildId);
  await controlled(container, worker);
  location.reload();
}
