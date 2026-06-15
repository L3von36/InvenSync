// InvenSync Service Worker v3
// Enhanced offline-first caching for PWA support
// - Cache-first for static assets (JS, CSS, fonts, images)
// - Network-first for API calls with cache fallback
// - Stale-while-revalidate for HTML pages
// - Runtime caching of Next.js static bundles on first load

const CACHE_NAME = 'invensync-v3';
const STATIC_CACHE = 'invensync-static-v3';
const API_CACHE = 'invensync-api-v3';
const RUNTIME_CACHE = 'invensync-runtime-v3';

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

// Fetch event — routing strategy
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

  // Skip Next.js hot reload and dev requests
  if (url.pathname.startsWith('/_next') && url.pathname.includes('.hot-update')) {
    return;
  }

  // Skip /api/ping - used for connectivity checks, don't cache
  if (url.pathname === '/api/ping') {
    return;
  }

  // Strategy: Network-first for API calls (but return cached when offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Strategy: Cache-first for Next.js static bundles (_next/static/*)
  // These are hashed and immutable — safe to cache aggressively
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstWithRuntime(request));
    return;
  }

  // Strategy: Cache-first for static assets (JS, CSS, images, fonts)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithRuntime(request));
    return;
  }

  // Strategy: Stale-while-revalidate for HTML pages
  event.respondWith(staleWhileRevalidate(request));
});

// Cache-first strategy with runtime caching
// Try cache first, fallback to network, cache the response for next time
async function cacheFirstWithRuntime(request) {
  // Check static cache first
  const staticCached = await caches.match(request, { cacheName: STATIC_CACHE });
  if (staticCached) {
    return staticCached;
  }

  // Check runtime cache next
  const runtimeCached = await caches.match(request, { cacheName: RUNTIME_CACHE });
  if (runtimeCached) {
    // Revalidate in background for next time
    fetchAndCacheRuntime(request);
    return runtimeCached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache in the runtime cache for offline use
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Last resort: check all caches
    const anyCached = await caches.match(request);
    if (anyCached) {
      return anyCached;
    }
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy with cache fallback for API calls
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Try API cache first
    const cached = await caches.match(request, { cacheName: API_CACHE });
    if (cached) {
      return cached;
    }
    // Try any cache
    const anyCached = await caches.match(request);
    if (anyCached) {
      return anyCached;
    }
    // Return offline JSON response
    return new Response(JSON.stringify({ error: 'You are offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stale-while-revalidate: Return cache if available, fetch in background to update
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // If network fails and we have cache, return it
      if (cached) {
        return cached;
      }
      // If no cache and offline, return offline page
      return new Response(offlinePage(), {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    });

  // Return cache immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// Background fetch and cache — doesn't block the response
async function fetchAndCacheRuntime(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
  } catch {
    // Silently ignore — background revalidation
  }
}

// Check if a pathname is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp',
    '.json', '.xml', '.txt', '.map',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
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
