/// <reference lib="webworker" />

// ============================================
// InvenSync Service Worker (Serwist)
// ============================================
// Replaces the hand-rolled public/sw.js (v4). Serwist injects a build-time
// precache manifest of every hashed asset, so pages the user never visited
// still load offline — the main gap of the old runtime-only cache.
//
// Strategy map:
// - Precache: all build assets (self.__SW_MANIFEST, injected at build)
// - /api/ping: network-only (connectivity heartbeat — never cached)
// - /api/* GET: network-first; when offline and uncached, respond with the
//   JSON sentinel { error: 'You are offline', offline: true } (503) that
//   api-client.ts converts into IndexedDB reconstructions
// - Everything else: Serwist's Next.js defaultCache (cache-first for
//   immutable /_next/static, tuned strategies per asset type)
// - Documents with no cache: fall back to the precached /~offline page
// - Non-GET requests are never intercepted (the api-client outbox owns them)

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Offline JSON sentinel understood by src/lib/api-client.ts */
function offlineApiResponse(): Response {
  return new Response(
    JSON.stringify({ error: "You are offline", offline: true }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Connectivity heartbeat — must reflect the real network state
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/ping",
      handler: new NetworkOnly(),
    },
    // API GETs — fresh when online, cached copy when offline, JSON offline
    // sentinel when offline with nothing cached
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "invensync-api",
        networkTimeoutSeconds: 10,
        plugins: [
          {
            handlerDidError: async () => offlineApiResponse(),
          },
        ],
      }),
    },
    // Next.js asset defaults (cache-first immutable chunks, SWR images, ...)
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Purge caches left behind by the legacy hand-rolled service worker
// (invensync-v4, invensync-static-v4, invensync-api-v4, invensync-runtime-v4)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("invensync-") && key !== "invensync-api")
          .map((key) => caches.delete(key))
      )
    )
  );
});

// ============================================
// Background Sync — drain the outbox even after the tab closes
// ============================================
// The page registers the 'invensync-outbox' tag whenever a mutation is
// queued offline (engine.addToOutbox). Chromium fires this event when
// connectivity returns; Firefox/Safari never do, so the page's foreground
// replay remains the baseline path.

interface SyncEventLike extends ExtendableEvent {
  readonly tag: string
}

self.addEventListener("sync", (event) => {
  const syncEvent = event as SyncEventLike;
  if (syncEvent.tag !== "invensync-outbox") return;

  syncEvent.waitUntil(
    import("@/lib/sync/sw-replay")
      .then((mod) => mod.replayOutboxFromSW())
      .then(async (result) => {
        // Tell any open pages so their sync UI refreshes
        const windows = await self.clients.matchAll({ type: "window" });
        for (const client of windows) {
          client.postMessage({ type: "OUTBOX_REPLAYED", ...result });
        }
        // Items left pending mean the network dropped again — reject so
        // the browser reschedules the sync with backoff
        if (result.remaining > 0) {
          throw new Error(`${result.remaining} outbox items still pending`);
        }
      })
  );
});

serwist.addEventListeners();
