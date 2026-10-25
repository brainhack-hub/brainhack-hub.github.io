/* brain-hack service worker
 * - App shell: stale-while-revalidate (instant open, refreshed in background).
 * - data/*.json: NETWORK-FIRST (so a new day's data shows immediately), falls back to cache offline.
 * - Bump VERSION whenever you change index.html / css / js / icons so old caches are purged.
 *   (Daily data updates do NOT require a bump.)
 */
const VERSION = 'v1.3.0';
const SHELL = 'bh-shell-' + VERSION;
const IMG = 'bh-img-v1'; // illustrations are content-addressed by idea id; kept across shell versions
const DATA = 'bh-data-' + VERSION;
const SHELL_ASSETS = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL, DATA, IMG];
    for (const k of await caches.keys()) if (k.startsWith('bh-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirstImage(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // external links/sources are not cached
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) { e.respondWith(networkFirst(req)); return; }
  if (url.pathname.includes('/assets/ideas/')) { e.respondWith(cacheFirstImage(req)); return; }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req, { cache: 'no-cache' }); const c = await caches.open(SHELL); c.put('index.html', res.clone()); return res; }
      catch (err) { const c = await caches.open(SHELL); return (await c.match('index.html')) || (await c.match('./')) || Response.error(); }
    })());
    return;
  }
  e.respondWith(staleWhileRevalidate(req));
});
