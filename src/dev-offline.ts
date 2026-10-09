/** A hard reload can bypass an old worker without removing its registration. */
export async function retireDevelopmentWorker() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const scope = new URL(import.meta.env.BASE_URL, location.href).href;
    const registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration?.scope !== scope) return;
    const script = new URL('sw.js', scope).href;
    if (![registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === script)) return;
    // Vite serves a one-time retiring worker at this URL. Never register one in development.
    await registration.update();
  } catch { /* Development remains usable when worker APIs or the network are unavailable. */ }
}
