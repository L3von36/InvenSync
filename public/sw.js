// InvenSync Service Worker
// Cache-first for static assets, Network-first for API calls, Offline fallback

const CACHE_NAME = 'invensync-v1';
const STATIC_CACHE = 'invensync-static-v1';
const API_CACHE = 'invensync-api-v1';
const OFFLINE_URL = '/offline';

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event — pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
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
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
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

  // Strategy: Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy: Cache-first for static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy: Stale-while-revalidate for pages
  event.respondWith(staleWhileRevalidate(request));
});

// Cache-first strategy: Try cache, fallback to network
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy: Try network, fallback to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'You are offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stale-while-revalidate: Return cache if available, fetch in background
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
      // If network fails and no cache, return offline page
      if (!cached) {
        return new Response(offlinePage(), {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return cached;
    });

  return cached || fetchPromise;
}

// Check if a pathname is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp',
    '.json', '.xml', '.txt',
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
    <p>It looks like you've lost your internet connection. Please check your network and try again.</p>
    <a href="/" class="btn">Try Again</a>
  </div>
</body>
</html>`;
}
