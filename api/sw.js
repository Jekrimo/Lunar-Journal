const CACHE = 'lunations-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Only cache same-origin assets
      return Promise.allSettled(ASSETS.map(url => c.add(url)));
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Only handle http/https — ignore chrome-extension and other schemes
  if(!url.protocol.startsWith('http')) return;
  
  // Never intercept API calls
  if(url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(res.ok && e.request.method === 'GET' && url.protocol.startsWith('http')) {
          try {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          } catch(err) {}
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
