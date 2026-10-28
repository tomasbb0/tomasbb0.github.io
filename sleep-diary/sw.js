const CACHE_VERSION = 9;
const CACHE_NAME = `sleep-diary-v${CACHE_VERSION}`;
const ASSETS = [
  '/sleep-diary/',
  '/sleep-diary/index.html',
  '/sleep-diary/styles.css',
  '/sleep-diary/app.js',
  '/sleep-diary/questions.js',
  '/sleep-diary/config.js',
  '/sleep-diary/manifest.json',
  '/sleep-diary/cursor.svg'
];

// Install - skip waiting to activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch - Network first, fall back to cache
self.addEventListener('fetch', (e) => {
  // Skip non-GET requests
  if (e.request.method !== 'GET') return;
  
  // Skip Firebase/external requests
  if (e.request.url.includes('firestore') || 
      e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Clone and cache the fresh response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Offline fallback for navigation
          if (e.request.mode === 'navigate') {
            return caches.match('/sleep-diary/index.html');
          }
        });
      })
  );
});

// Activate - clean old caches immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});
