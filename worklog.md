---
Task ID: 1
Agent: Main Agent
Task: Complete authentication audit for 401 Unauthorized on /api/notifications

Work Log:
- Explored entire codebase structure: 80+ API routes, 915-line Prisma schema, hybrid JWT+Supabase auth
- Identified ROOT CAUSE: RealtimeClient.poll() uses raw fetch() without Authorization header
- Found 6+ additional raw fetch() calls missing auth or using inconsistent patterns
- Found Supabase middleware updateSession() never called from main middleware
- Found cron/check-expiries endpoint rejects JWT-authenticated frontend calls
- Found "Authorization: Bearer null" sent when no token in localStorage
- Implemented Fix #1: Added getAuthHeaders() to RealtimeClient.poll() with auth-readiness guard
- Implemented Fix #2: Created shared /src/lib/auth-fetch.ts with authFetch() helper
- Implemented Fix #3: Replaced all raw fetch() calls with authFetch() in:
  - scheduled-reports-page.tsx (4 fetch calls)
  - products-page.tsx (1 fetch call)
  - security-tab.tsx (1 fetch call)
  - settings-page.tsx (1 fetch call)
  - sales-rep-dashboard-page.tsx (2 fetch calls)
  - auth-store.ts (1 logout fetch call)
  - layout/header.tsx (1 cron fetch call)
- Implemented Fix #4: Integrated Supabase updateSession() in middleware.ts
- Implemented Fix #5: Added auth-readiness guard in RealtimeClient (skip poll if no token)
- Implemented Fix #6: Updated cron/check-expiries to accept JWT auth as alternative to cron secret
- Implemented Fix #7: authFetch/getAuthHeaders guards against "Bearer null"
- Implemented Fix #8: Improved JWT_SECRET error message with Vercel setup instructions
- Verified lint passes clean on all modified files
- Verified /api/notifications returns 401 without auth (correct), /api/auth/me works with JWT

Stage Summary:
- ROOT CAUSE: RealtimeClient.poll() used raw fetch() without Authorization Bearer header
- Created /src/lib/auth-fetch.ts as centralized auth-aware fetch utility
- Fixed 10+ raw fetch() calls across 7 component files
- Integrated Supabase session refresh in middleware
- All protected routes now correctly require and validate JWT tokens
- ESLint passes with no new errors

---
Task ID: 2
Agent: Main Agent
Task: Fix product types not showing after creation and not appearing in Add Product dropdown

Work Log:
- Investigated product types API route (GET /api/product-types)
- Found ROOT CAUSE: When shopId is provided, the query uses `products: { some: ... }` filter which excludes product types with zero products — newly created types are invisible
- Found missing cache invalidation after product type mutations in api-client.ts
- Found fetchProductTypes in products-page.tsx missing currentShop dependency
- Found products page never re-fetches product types when Add Product dialog opens
- Found silent error swallowing hides API failures
- Fixed API route: Removed shopId filter from ProductType query (types are org-level, not shop-level); product count is now filtered by shopId when provided
- Fixed api-client.ts: Added invalidateCache('GET:/api/product-types') after create/update/delete
- Fixed products-page.tsx: Added currentShop?.id to fetchProductTypes dependency array
- Fixed products-page.tsx: Re-fetch product types when Add Product dialog opens
- Fixed products-page.tsx: Replaced silent catch with console.warn for debugging
- Fixed products-page.tsx: All setDialogOpen(true) calls now go through handleDialogClose for consistent re-fetching
- Verified lint passes clean
- Verified API endpoint compiles and returns correct responses

Stage Summary:
- ROOT CAUSE: GET /api/product-types with shopId used `products: { some: ... }` filter, hiding types with zero products
- 4 bugs fixed across 3 files
- Product types will now appear immediately after creation
- Product types will appear in the Add Product dropdown
