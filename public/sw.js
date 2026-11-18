const CACHE_NAME = 'study-tracker-v1';

const PRECACHE_URLS = [
  '/',
  '/manifest.json'
];

// External APIs that must always hit the live network and never be served stale from cache
const LIVE_API_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'www.googleapis.com',
  'googleapis.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'generativelanguage.googleapis.com'
];

function isLiveApiRequest(url) {
  return LIVE_API_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests; let POST/PUT/DELETE (sync, telemetry, OAuth) go directly to network
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only intercept HTTP(S) traffic
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Google Apps Script, Google Drive, Google OAuth, and Gemini AI requests always go straight to network
  if (isLiveApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Only cache same-origin assets using a Network-First strategy
  if (url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset = /\.(?:css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Offline navigation fallback to root app shell
        if (request.mode === 'navigate' && !isStaticAsset) {
          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;
        }
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
