// Netz zuerst für eigene Dateien, Cache nur als Rückfall für offline (Skill app-update-iphone)
const CACHE = 'wuerfel';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png',
  ...[4, 5, 6, 7, 8, 9, 10].map(n => `./tiere/${n}.webp`)];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // nichts Fremdes im Spiel
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
