const CACHE_NAME = 'samjin-pwa-v10-contact-safe';
const STATIC_ASSETS = ['./','./index.html','./style.css','./app.js','./config.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => undefined))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)); return res; }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html'))));
});
