// InvenSync Service Worker v4
// Enhanced offline-first caching for PWA support
// - Cache-first for static assets (JS, CSS, fonts, images)
// - Network-first for API calls with cache fallback
// - Stale-while-revalidate for HTML pages
// - Runtime caching of Next.js static bundles on first load
//
// v4: Bumps all cache names so stale v3 caches (which could pin old,
// pre-fix JS bundles in dev mode and mask the offline fix) are purged
// on activation.

const CACHE_NAME = 'invensync-v4';
const STATIC_CACHE = 'invensync-static-v4';
const API_CACHE = 'invensync-api-v4';
const RUNTIME_CACHE = 'invensync-runtime-v4';

// Core static assets to pre-cache on install
const PRE_CACHE_ASSETS = [
  '/',
  '/manifest.json',
];

// Install event — pre-cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRE_CACHE_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some pre-cache assets:', err);
      });
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Fetch event — unified network-first strategy with cache fallback.
//
// Every GET request (API, JS/CSS bundles, static assets, HTML pages) uses the
// same strategy: try the network first, cache the response on success, and
// fall back to the cache (any cache) when the network is unavailable.
//
// Why network-first for everything (instead of cache-first for static assets)?
// In development, Turbopack recompiles chunks on every edit and changes their
// hashes. A cache-first SW would pin stale pre-edit bundles and mask code
// changes — including offline fixes — making dev iteration impossible.
// Network-first always fetches fresh content while online (so HMR/recompiles
// are reflected immediately) and only relies on the cache when actually
// offline. The small latency cost in production is acceptable for an
// offline-first business app where correctness matters more than byte-speed.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip Next.js hot reload and dev requests — never cache/intercept these
  if (url.pathname.startsWith('/_next') && url.pathname.includes('.hot-update')) {
    return;
  }

  // Skip /api/ping - used for connectivity checks, don't cache
  if (url.pathname === '/api/ping') {
    return;
  }

  event.respondWith(networkFirstWithCache(request));
});

// Network-first strategy with cache fallback — used for ALL GET requests.
//
// Online: fetch from network, cache the response, return it. Always fresh.
// Offline: try the API cache, then ANY cache. If nothing is cached:
//   - API requests -> 503 { error: 'You are offline', offline: true } so the
//     api-client can reconstruct the response from IndexedDB entity tables.
//   - Non-API requests (HTML/JS/CSS) -> the static offline page.
async function networkFirstWithCache(request) {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  // Pick the right cache to write to: API responses go to API_CACHE, every
  // other resource (HTML, JS, CSS, fonts, images) goes to RUNTIME_CACHE.
  const targetCache = isApi ? API_CACHE : RUNTIME_CACHE;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(targetCache);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed (offline). Try the target cache first, then any cache.
    const cached = await caches.match(request, { cacheName: targetCache });
    if (cached) {
      return cached;
    }
    try {
      const anyCached = await caches.match(request);
      if (anyCached) {
        return anyCached;
      }
    } catch {
      // Fall through to offline response
    }
    // Nothing cached. For API requests, return a JSON offline response the
    // api-client knows how to handle (it reconstructs data from IndexedDB).
    // For everything else, return the static offline HTML page.
    if (isApi) {
      return new Response(JSON.stringify({ error: 'You are offline', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(offlinePage(), {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// Generate offline fallback page
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InvenSync - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f8fafc;
      color: #334155;
    }
    .container {
      text-align: center;
      padding: 32px;
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      border-radius: 50%;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 32px; height: 32px; color: #64748b; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      padding: 10px 24px;
      background: #0f172a;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    </div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Your data is still available locally. Please check your network and try again.</p>
    <a href="/" class="btn">Try Again</a>
  </div>
</body>
</html>`;
}
