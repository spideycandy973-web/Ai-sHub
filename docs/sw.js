/* Ai'sHub service worker - offline shell for the PWA build.
 * API calls are never cached; the app's own local engine works with zero network. */
const CACHE = 'aishub-1.0.0-ef29c5f08744';
const SHELL = ["./","./index.html","./manifest.webmanifest","./logo.png","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./favicon.png","./apple-touch-icon.png"];
const REV = 'ef29c5f08744';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('aishub-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch API traffic

  const isShell = SHELL.some((p) => new URL(p, self.location).pathname === url.pathname) || url.pathname.endsWith('/');
  if (isShell) {
    // stale-while-revalidate keeps launches instant and self-updating
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network.catch(() => undefined));
          return cached;
        }
        return (await network) || (await cache.match('./index.html')) || Response.error();
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  if (event.data === 'version') event.source?.postMessage({ type: 'version', rev: REV, cache: CACHE });
});
