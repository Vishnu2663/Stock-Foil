// Offline-first service worker that can never trap a visitor on an old version.
//  - pages and other unhashed files: NETWORK first, cache only as the offline fallback
//  - /assets/* (content-hashed, immutable): CACHE first
//  - on upgrade: old caches are deleted and open tabs are refreshed onto the new version
const CACHE = 'stock-foil-v2';
const SHELL = ['./', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : undefined)).catch(() => undefined)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const upgrading = keys.some((k) => k !== CACHE && k.startsWith('stock-foil-'));
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    if (upgrading) {
      // someone is looking at the old version: move them onto the new one
      const open = await self.clients.matchAll({ type: 'window' });
      open.forEach((c) => { try { c.navigate(c.url); } catch (_) { /* ignore */ } });
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const hashed = url.pathname.includes('/assets/');
  if (hashed) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  // pages, manifest, icon, sw: always try the network first so a new deploy is seen at once
  e.respondWith(
    fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './' : req, copy)); } return res; })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req).then((hit) => hit || caches.match('./'))),
  );
});
