import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist generates public/sw.js at build time with a precache manifest of
// every hashed build asset, so all pages/chunks work offline — including
// ones the user never visited (the gap in the old hand-rolled sw.js).
const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // The app registers the service worker itself in src/app/layout.tsx
  // (with an https/localhost guard) — don't inject a second registration.
  register: false,
  // Never hard-reload the page when connectivity returns — a cashier
  // mid-sale on a flaky connection would lose their in-progress form.
  reloadOnOnline: false,
  // Serve navigations from the precache so page loads work offline
  // even for routes the user hasn't visited yet.
  cacheOnNavigation: true,
  // No service worker in dev: Turbopack recompiles chunks on every edit,
  // and a SW would pin stale bundles and mask code changes.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Type errors now fail the build — the codebase is type-clean (see `npx tsc --noEmit`).
  // Keeping this enforced prevents regressions from silently shipping.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Strict mode double-invokes effects in dev to surface unsafe patterns
  // (stale closures, missing cleanup) before they ship.
  reactStrictMode: true,

  // Enable gzip compression for responses
  compress: true,

  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "jsonwebtoken",
    "sharp",
    "docx",
  ],

  // Optimize barrel imports — tells webpack to tree-shake these packages
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "framer-motion",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Security and caching headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
