import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionExpiryHandler } from "@/components/shared/session-expiry-handler";

// ============================================
// Font Optimization — next/font eliminates FOUT and layout shift
// ============================================
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NOTE: userScalable removed — allowing pinch-to-zoom is an accessibility requirement (WCAG 1.4.4)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  title: "InvenSync - Smart Inventory Management",
  description:
    "Multi-tenant inventory & sales management system with AI-powered features. Track products, manage sales, and get business insights.",
  keywords: [
    "inventory",
    "sales",
    "management",
    "AI",
    "business",
    "SaaS",
    "Ethiopia",
    "point of sale",
    "stock tracking",
    "debt management",
  ],
  authors: [{ name: "InvenSync" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "InvenSync",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  // Open Graph — social sharing previews
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "InvenSync",
    title: "InvenSync - Smart Inventory Management",
    description:
      "Track inventory, record every sale, manage debts, and know your exact profit daily — all in one place.",
  },
  // Twitter Card
  twitter: {
    card: "summary",
    title: "InvenSync - Smart Inventory Management",
    description:
      "Track inventory, record every sale, manage debts, and know your exact profit daily — all in one place.",
  },
  // Tell crawlers the canonical URL format
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Preconnect to font CDN — eliminates DNS/TCP/TLS latency */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Leaflet CSS — lazy-loaded by map components via dynamic import */}

        {/* PWA manifest is already declared in metadata export above; this is a fallback for older browsers */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple PWA meta tags — already handled by metadata export but kept for backward compat */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="InvenSync" />
      </head>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <SessionExpiryHandler />
        {/* Global ChunkLoadError auto-reload listener.
            Runs before React hydrates so it catches chunk errors that happen
            outside React's error boundaries (event handlers, unhandled promise
            rejections). Uses the same sessionStorage key + limit as the React
            error boundary and route error.tsx so at most ONE auto-reload occurs
            per session — preventing infinite loops if the new deployment is
            also broken. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var KEY = 'invensync_chunk_reloaded';
                var LIMIT = 1;
                function isChunkErr(msg, name) {
                  msg = msg || ''; name = name || '';
                  return name === 'ChunkLoadError' ||
                    msg.indexOf('Failed to load chunk') > -1 ||
                    msg.indexOf('Loading chunk') > -1 ||
                    msg.indexOf('ChunkLoadError') > -1 ||
                    msg.indexOf('dynamically imported module') > -1;
                }
                function canReload() {
                  try {
                    var c = parseInt(sessionStorage.getItem(KEY) || '0', 10);
                    if (c >= LIMIT) return false;
                    sessionStorage.setItem(KEY, String(c + 1));
                    return true;
                  } catch (e) { return true; }
                }
                // Catch synchronous errors (e.g. <script> chunk load failures)
                window.addEventListener('error', function(e) {
                  var err = e.error || e;
                  if (isChunkErr(err && err.message, err && err.name) && canReload()) {
                    console.warn('[ChunkGuard] ChunkLoadError — auto-reloading');
                    window.location.reload();
                  }
                });
                // Catch dynamic import failures that reject as unhandled promises
                window.addEventListener('unhandledrejection', function(e) {
                  var err = e.reason;
                  if (isChunkErr(err && err.message, err && err.name) && canReload()) {
                    console.warn('[ChunkGuard] ChunkLoadError (promise) — auto-reloading');
                    e.preventDefault();
                    window.location.reload();
                  }
                });
              })();
            `,
          }}
        />
        {/* Service Worker Registration — enables offline page loads by serving
            cached HTML/JS bundles when the network is unavailable. The SW uses
            a network-first strategy (public/sw.js) so dev HMR stays fresh, and
            the api-client handles the SW's offline 503 responses for uncached
            API endpoints (e.g. /api/auth/me) by reconstructing data from
            IndexedDB. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[InvenSync] SW registered:', reg.scope);
                  }).catch(function(err) {
                    console.warn('[InvenSync] SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
