const CACHE_NAME = 'rapipos-runtime-v1';

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache will be populated on first fetch
      return cache.addAll(['/']);
    }).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — clean old caches aggressively
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

// Fetch — network first for everything to prevent blank pages
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: always network, never cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ success: false, error: 'Offline — server tidak terjangkau' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // For HTML pages: ALWAYS network first, minimal caching to prevent blank pages in Chrome
  if (e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname === '/') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => {
        // Only fallback to cache if network fails
        return caches.match('/').then(cached => cached || 
          new Response('<!DOCTYPE html><html><body><h1>Offline</h1><p>Network error, please refresh</p></body></html>', {
            headers: { 'Content-Type': 'text/html' }
          })
        );
      })
    );
    return;
  }

  // Static assets: cache first for performance
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful GET responses for static assets
        if (e.request.method === 'GET' && res.status === 200 && 
            (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || 
             url.pathname.endsWith('.woff') || url.pathname.endsWith('.woff2'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
