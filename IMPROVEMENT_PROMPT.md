# InvenSync — Full Production Improvement Prompt
> Generated: 2026-07-11 | Covers UI, Frontend, Backend, Infrastructure, Offline, Security, Testing

---

## HOW TO USE THIS DOCUMENT

Work through **Phases 0–11 in order**. Each phase builds on the previous. Do not skip Phase 0 — it contains critical bugs that will cause data loss or security breaches in production. Mark each item complete before moving to the next phase.

---

## PHASE 0 — CRITICAL BUGS (Fix Before Anything Else)

### 0.1 SQLite in Production
**File:** `prisma/schema.prisma`, `scripts/vercel-build.sh`

The schema currently uses SQLite as the provider. The build script mutates the schema file at build time using `sed` which causes dirty git state. This pattern is fragile — a failed `sed` replacement silently ships SQLite to production.

**Fix:**
- Remove the `sed` mutation from `vercel-build.sh`
- Set `provider = "postgresql"` permanently in `schema.prisma`
- Add `directUrl = env("DIRECT_URL")` (see Phase 11.2)
- Keep a local `.env` with a local Postgres or Supabase dev project URL

### 0.2 In-Memory Rate Limiting on Vercel Serverless
**File:** `src/lib/rate-limit.ts`

The current token bucket implementation stores state in a JavaScript `Map` in process memory. Vercel spins up a new serverless function instance per request (or per cold start). Every new instance starts with an empty rate limit state — meaning an attacker can bypass rate limiting completely by triggering enough cold starts (easy to do via concurrent requests).

**Fix:** Replace with Upstash Redis — see Phase 11.3.

### 0.3 Cron Endpoint — Unauthenticated Access
**File:** `src/app/api/cron/check-expiries/route.ts` line 33–37

When `CRON_SECRET` environment variable is not set, the route allows all requests through. This means in a local dev environment (or if the env var is ever accidentally unset in production), anyone on the internet can trigger your cron job.

**Fix:**
```typescript
// Always require the secret — no fallback open access
const secret = process.env.CRON_SECRET
if (!secret) {
  return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
}
if (request.headers.get('authorization') !== `Bearer ${secret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 0.4 Supabase Client at Module Level (Session Leak)
**Applies to:** Every file using `createServerClient`

On Vercel Fluid compute, warm instances are reused across requests. A Supabase client created at module scope caches the first user's cookies and serves them to all subsequent users — User A's session bleeds into User B's requests.

**Fix:** Move every `createServerClient(...)` call inside the request handler function body. See Phase 11.1 for the full pattern.

### 0.5 getSession() Used for Authorization
**Applies to:** All auth middleware and route handlers

`supabase.auth.getSession()` reads the JWT from the local cookie without contacting Supabase servers. A revoked or expired token still passes. Use `supabase.auth.getUser()` for any authorization check — it validates the token against the Supabase server on every call.

### 0.6 No Email Verification on Register
**File:** `src/app/api/auth/register/route.ts`

New accounts are immediately active with no email confirmation. Anyone can register with a fake email.

**Fix:** After `user` record creation, send a verification email via Supabase Auth or your own email provider (Resend is recommended). Block login until `emailVerified` is set. Add `emailVerified DateTime?` and `emailVerificationToken String?` to the `User` model.

### 0.7 JWT Parsed from localStorage to Check Expiry
**File:** `src/lib/stores/auth-store.ts`

Parsing a JWT from localStorage and trusting its `exp` claim to determine session validity is insecure. A tampered token with a future `exp` date would appear valid client-side.

**Fix:** Session validity must be determined server-side by calling `getUser()`. On the client, treat the locally-stored token as a hint only — always confirm with the server before sensitive actions.

---

## PHASE 1 — INFRASTRUCTURE & ENVIRONMENT

### 1.1 Environment Variables
Create `.env.example` with every variable the app needs, with comments:
```env
# Database — Supabase (see Phase 11.2 for why both are required)
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# JWT signing
JWT_SECRET="generate with: openssl rand -hex 64"

# 2FA encryption (generate with: openssl rand -hex 32)
TOTP_ENCRYPTION_KEY="..."

# Rate limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Payments (Chapa)
CHAPA_SECRET_KEY="..."
CHAPA_WEBHOOK_SECRET="..."

# Cron security
CRON_SECRET="generate with: openssl rand -hex 32"

# Monitoring
SENTRY_DSN="..."
NEXT_PUBLIC_SENTRY_DSN="..."
SENTRY_AUTH_TOKEN="..."

# Analytics
NEXT_PUBLIC_POSTHOG_KEY="..."

# Feature flags
NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY="..."

# Email (Resend)
RESEND_API_KEY="..."
EMAIL_FROM="noreply@yourdomain.com"

# App
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
LOG_LEVEL="info"
```

### 1.2 Health Check Endpoints
Create two tiers:

```typescript
// app/api/health/live/route.ts — liveness (is the process running?)
export async function GET() {
  return NextResponse.json({ status: 'ok', ts: Date.now() })
}

// app/api/health/ready/route.ts — readiness (can it serve traffic?)
export async function GET() {
  const checks = await Promise.allSettled([
    db.$queryRaw`SELECT 1`,
    redis.ping(),
  ])
  const db_ok = checks[0].status === 'fulfilled'
  const cache_ok = checks[1].status === 'fulfilled'
  const ready = db_ok && cache_ok
  return NextResponse.json(
    { status: ready ? 'ok' : 'degraded', db: db_ok, cache: cache_ok },
    { status: ready ? 200 : 503 }
  )
}
```

Add these URLs to your uptime monitoring (Better Uptime, UptimeRobot, or Vercel's own monitoring).

### 1.3 Enable React Strict Mode
**File:** `next.config.ts`

```typescript
const nextConfig = {
  reactStrictMode: true, // was false — strict mode catches many real bugs
  // ...
}
```

### 1.4 Prisma Connection Pool Sizing
For Vercel serverless + Supabase PgBouncer, the pool size must be kept small to avoid exhausting the connection limit:

```env
DATABASE_URL="...?pgbouncer=true&connection_limit=1&pool_timeout=30"
```

Each serverless function should use at most 1 connection since they're short-lived. Setting `connection_limit=1` prevents the function from holding open multiple connections.

---

## PHASE 2 — PAYMENTS & SUBSCRIPTIONS

### 2.1 Chapa Webhook Verification
**File:** `src/app/api/webhooks/chapa/route.ts` (create this file)

```typescript
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-chapa-signature') ?? ''
  
  // Verify HMAC-SHA256 signature
  const expected = crypto
    .createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const payload = JSON.parse(rawBody)
  const { tx_ref, status } = payload
  
  // Idempotency — ignore duplicate deliveries
  try {
    await db.chapaWebhookEvent.create({
      data: { txRef: tx_ref, status: 'received', payload }
    })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      // Unique constraint violation = already processed
      return NextResponse.json({ received: true })
    }
    throw e
  }
  
  if (status === 'success') {
    // Activate subscription, update billing record
    await db.$transaction(async (tx) => {
      const order = await tx.subscriptionOrder.findUnique({ where: { txRef: tx_ref } })
      if (!order) throw new Error(`Order not found: ${tx_ref}`)
      await tx.organization.update({
        where: { id: order.organizationId },
        data: { plan: order.targetPlan, planExpiresAt: order.expiresAt }
      })
      await tx.chapaWebhookEvent.update({
        where: { txRef: tx_ref },
        data: { status: 'fulfilled' }
      })
    })
  }
  
  return NextResponse.json({ received: true })
}
```

Add the `ChapaWebhookEvent` model to `schema.prisma` (see Phase 11.7).

### 2.2 Remove Admin Payment Bypass
**File:** `src/app/api/subscriptions/route.ts` around line 105

The TODO comment indicates admins can upgrade organizations directly without payment. Remove this bypass — even admin-initiated upgrades should go through the webhook flow so there's an audit trail.

### 2.3 Subscription Expiry Grace Period
When a subscription expires, do not immediately remove access. Add a 3-day grace period:
```typescript
const isActive = org.planExpiresAt 
  ? org.planExpiresAt > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  : false
```
Show a banner on the dashboard during grace period: "Your subscription expired 2 days ago. Renew to keep access."

---

## PHASE 3 — API HARDENING

### 3.1 Input Validation with Zod
Every API route must validate its request body before touching the database:

```typescript
import { z } from 'zod'

const CreateSaleSchema = z.object({
  organizationId: z.string().cuid(),
  customerId: z.string().cuid().optional(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().positive().max(10000),
    price: z.number().nonnegative(),
  })).min(1).max(200),
  paymentMethod: z.enum(['cash', 'chapa', 'credit']),
  discount: z.number().nonnegative().max(100).default(0),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = CreateSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  // use parsed.data — it is typed and validated
}
```

Apply to: all POST/PUT/PATCH route handlers across the entire API.

### 3.2 Cursor-Based Pagination
Replace offset pagination with cursor-based pagination on all list endpoints. See Phase 11.15 for the full implementation.

### 3.3 Database Transaction Wrapping
Any operation that touches more than one table must be wrapped in a `db.$transaction()`:
- Sale creation (sale + saleItems + stock decrement + audit log)
- Purchase order receipt (purchase order status + stock increment + expense)
- Organization registration (user + org + default modules + business template)

### 3.4 organizationId Scoping Audit
Every `db.model.findMany()` and `db.model.findFirst()` must include `where: { organizationId }`. Write a grep script to find any that are missing:

```bash
grep -r "findMany\|findFirst\|findUnique" src/app/api --include="*.ts" | grep -v "organizationId"
```

Review every result manually. A missing `organizationId` scope is a tenant data leak.

### 3.5 Soft Delete
Add `deletedAt DateTime?` to Product, Customer, Supplier in `schema.prisma`. Use the Prisma soft delete extension — see Phase 11.13.

---

## PHASE 4 — AUTHENTICATION & SECURITY

### 4.1 Session Revocation
**File:** `src/lib/auth.ts`, `prisma/schema.prisma`

Add `revokedAt DateTime?` to the `Session` model. In `getUserFromJWT()`, check:
```typescript
const session = await db.session.findUnique({ where: { token: jti } })
if (!session || session.revokedAt) throw new UnauthorizedError('Session revoked')
```

Revoke all sessions on password change and "logout all devices" actions.

### 4.2 Password Reset Flow
There is no password reset endpoint. Add:
1. `POST /api/auth/forgot-password` — generates a signed, time-limited token (15 min), emails a reset link
2. `POST /api/auth/reset-password` — validates token, hashes and saves new password, revokes all existing sessions

Use a `PasswordResetToken` table (not URL params) to store tokens — they are single-use and expire.

### 4.3 TOTP Secret Encryption at Rest
Encrypt TOTP secrets before storing in the database. See Phase 11.4 for the AES-256-GCM implementation.

### 4.4 Content Security Policy Tightening
**File:** `src/middleware.ts`

The current CSP uses `unsafe-inline` for scripts (required by Next.js for hydration). Migrate to nonce-based CSP:
```typescript
const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
const csp = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
  style-src 'self' 'nonce-${nonce}';
  img-src 'self' blob: data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com;
  font-src 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim()
```

Pass `nonce` to Next.js via headers so it can attach it to inline scripts.

### 4.5 Audit Log on Sensitive Actions
Every destructive or privileged action must write to the audit log:
- Login success/failure
- Password change
- Role change
- Product deletion
- Subscription change
- Module enable/disable
- Data export

The `AuditLog` table should include: `organizationId`, `userId`, `action`, `resourceType`, `resourceId`, `ipAddress`, `userAgent`, `metadata` (JSON), `createdAt`.

---

## PHASE 5 — OFFLINE-FIRST HARDENING

### 5.1 Conflict Resolution Strategy
The current sync engine optimistically applies local changes on top of server state. Define an explicit conflict resolution policy:

- **Last Write Wins (LWW):** Default for most fields. The change with the later `updatedAt` timestamp wins.
- **Server Wins:** For fields that should never be overridden by offline changes (e.g., `stock.quantity` — server is authoritative because another user may have sold the same item while you were offline).
- **Manual merge required:** For fields where both values matter (e.g., two cashiers both added notes to the same customer).

Implement a `ConflictLog` table to record and surface conflicts to users:
```prisma
model ConflictLog {
  id           String   @id @default(cuid())
  organizationId String
  table        String
  recordId     String
  localValue   Json
  serverValue  Json
  resolvedBy   String   // 'local' | 'server' | 'manual'
  resolvedAt   DateTime @default(now())
  
  @@index([organizationId, resolvedAt])
}
```

Show unresolved conflicts in the dashboard as a notification badge.

### 5.2 Outbox Retry with Exponential Backoff
The current outbox replays all pending mutations on reconnect without backoff. A mutation that keeps failing (e.g., product was deleted on server) will loop forever.

```typescript
// Add to outbox schema:
// retryCount Int @default(0)
// lastError  String?
// nextRetryAt DateTime?

async function replayOutbox() {
  const now = new Date()
  const pending = await db.outbox
    .where('status').equals('pending')
    .and(item => !item.nextRetryAt || new Date(item.nextRetryAt) <= now)
    .toArray()

  for (const item of pending) {
    try {
      await replayMutation(item)
      await db.outbox.delete(item.id)
    } catch (err) {
      const retryCount = (item.retryCount ?? 0) + 1
      const backoffMs = Math.min(1000 * 2 ** retryCount, 30 * 60 * 1000) // max 30 min
      await db.outbox.update(item.id, {
        retryCount,
        status: retryCount >= 10 ? 'failed' : 'pending',
        lastError: String(err),
        nextRetryAt: new Date(Date.now() + backoffMs).toISOString(),
      })
    }
  }
}
```

### 5.3 Offline Indicator Component
Add a persistent, non-intrusive offline indicator:

```typescript
// src/components/ui/offline-indicator.tsx
'use client'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800 shadow-lg">
      <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
      Working offline — changes will sync when reconnected
    </div>
  )
}
```

Show it in the root layout. Do NOT show a blocking modal — users need to keep working.

### 5.4 IndexedDB Schema Versioning
**File:** `src/lib/db/index.ts`

The current Dexie schema is version 1 with no upgrade path. Before adding any new field to a Dexie table or adding a new table, you must bump the version and define an upgrade:

```typescript
this.version(1).stores({ /* current */ })
this.version(2).stores({
  // same as v1 plus new table
  conflictLogs: '++id, organizationId, resolvedAt',
}).upgrade(tx => {
  // migrate existing data if needed
  return tx.table('outbox').toCollection().modify(item => {
    item.retryCount = item.retryCount ?? 0
  })
})
```

Never modify a `version(N)` block that has already shipped to users — only add new `version(N+1)` blocks.

### 5.5 Background Sync Safari Fallback
See Phase 11.6 Fix 3 — the Background Sync API is Chromium-only. Add the `window.addEventListener('online', ...)` fallback for Safari.

---

## PHASE 6 — UI / UX IMPROVEMENTS

### 6.1 Loading States — Skeleton Screens
Replace all spinner-based loading with skeleton screens that match the layout of the loaded content. This dramatically reduces perceived load time (users see structure immediately).

```typescript
// Instead of:
if (isLoading) return <Spinner />

// Do:
if (isLoading) return <DashboardSkeleton />

// src/components/skeletons/dashboard-skeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
      ))}
      <div className="col-span-4 h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  )
}
```

### 6.2 Error States — Actionable Error Messages
Replace generic error toasts with contextual, actionable error messages:

```typescript
// Bad:
toast.error('Something went wrong')

// Good:
toast.error('Could not save sale — stock level is too low', {
  action: {
    label: 'Check inventory',
    onClick: () => router.push('/inventory'),
  },
  duration: 8000,
})
```

Every error state in list pages should show:
1. What went wrong (specific, not "error occurred")
2. Why it went wrong (if known)
3. What the user can do (retry button, link to relevant page)

### 6.3 Empty States — Helpful Onboarding
Every list page that can be empty should show a helpful empty state instead of an empty table:

```typescript
if (products.length === 0) {
  return (
    <EmptyState
      icon={Package}
      title="No products yet"
      description="Add your first product to start tracking inventory"
      action={{ label: 'Add product', href: '/products/new' }}
    />
  )
}
```

### 6.4 Mobile-First Responsive Design
The Ethiopian market is 95%+ mobile. Audit every page for:
- **Touch targets:** All interactive elements must be ≥44×44px
- **Table overflow:** Replace data tables with card lists on mobile (`hidden md:table-cell` for non-essential columns)
- **Form fields:** Font size ≥16px on inputs to prevent iOS auto-zoom
- **Bottom navigation:** Consider a bottom tab bar for mobile instead of a sidebar

```typescript
// Mobile-friendly table pattern
<div className="md:hidden space-y-3">
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</div>
<table className="hidden md:table w-full">
  {/* Full table for desktop */}
</table>
```

### 6.5 Form Validation — Inline, Not Toast
Move form validation errors from toast notifications to inline field errors:

```typescript
// Using react-hook-form + Zod resolver
const form = useForm<CreateProductInput>({
  resolver: zodResolver(CreateProductSchema),
})

// In JSX:
<FormField
  control={form.control}
  name="price"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel>Price (ETB)</FormLabel>
      <FormControl>
        <Input type="number" {...field} />
      </FormControl>
      {fieldState.error && (
        <FormMessage>{fieldState.error.message}</FormMessage>
      )}
    </FormItem>
  )}
/>
```

### 6.6 Confirmation Dialogs for Destructive Actions
Never delete or void on single click. Use a confirmation dialog with the item name:

```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{product.name}"?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete the product and all associated stock records.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => deleteProduct(product.id)} className="bg-destructive">
        Delete product
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 6.7 Keyboard Navigation & Accessibility
- Add `aria-label` to all icon-only buttons
- Ensure all modals trap focus and restore it on close
- Add `aria-live="polite"` to regions that update (notifications, stock counts)
- Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>` — not just `<div>`
- Test with keyboard only: Tab through every interactive element, confirm logical order
- Add `prefers-reduced-motion` support to all Framer Motion animations:

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const variants = {
  initial: prefersReducedMotion ? {} : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}
```

### 6.8 Dashboard — Role-Based Customization
Allow users to pin/hide KPI cards based on their role:
```typescript
// Store in user preferences (saved to IndexedDB + server)
interface DashboardPreferences {
  pinnedCards: string[]
  hiddenCards: string[]
  cardOrder: string[]
}
```

Show a "Customize dashboard" button in the header that opens a drag-to-reorder interface.

### 6.9 Number Formatting for Ethiopia
Always format currency as Ethiopian Birr (ETB) with thousands separators:

```typescript
// src/lib/format.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-ET').format(n)
}
```

Use `formatCurrency()` everywhere a monetary value is displayed. Never render raw numbers.

### 6.10 Dark Mode
The app should respect `prefers-color-scheme` by default and allow manual override:

```typescript
// Use next-themes
import { ThemeProvider } from 'next-themes'

// In root layout:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

Audit all hardcoded color values in Tailwind classes — replace `bg-white`, `text-gray-900` etc. with semantic tokens (`bg-background`, `text-foreground`).

---

## PHASE 7 — MONITORING & OBSERVABILITY

### 7.1 Sentry Error Tracking
Install: `bun add @sentry/nextjs`

Run: `npx @sentry/wizard -i nextjs` — it creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

**Critical:** Create `instrumentation.ts` at the project root (see Phase 11.9 for the exact content — the `onRequestError` hook is required for App Router).

**Critical:** Create `app/global-error.tsx` (also in Phase 11.9 — `error.tsx` does not catch layout-level errors).

Set these Sentry options:
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [Sentry.prismaIntegration()], // traces slow DB queries
})
```

### 7.2 Alerting Rules
Set up Sentry alert rules:
- New error first seen → immediate Slack/email notification
- Error rate > 5/min on any endpoint → page on-call
- P95 response time > 2s → warning
- P95 response time > 5s → critical

### 7.3 Structured Logging with Pino
See Phase 11.10 for the complete Pino setup. Set up a Vercel Log Drain to Axiom for log aggregation and search.

Always log structured context, never bare strings:
```typescript
// Bad
logger.error('Failed to create sale')

// Good
logger.error({ err, orgId, userId, saleData }, 'Sale creation failed')
```

### 7.4 Performance Monitoring
Add timing annotations to slow operations:
```typescript
const span = Sentry.startSpan({ name: 'dashboard.loadAllData' }, async () => {
  return await Promise.all([
    db.sale.count(...),
    db.product.count(...),
    // ...
  ])
})
```

Add Web Vitals reporting:
```typescript
// app/layout.tsx
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label === 'web-vital') {
    logger.info({ metric: metric.name, value: metric.value, rating: metric.rating })
  }
}
```

---

## PHASE 8 — FEATURE FLAGS & MODULE SYSTEM

### 8.1 GrowthBook Integration
Use GrowthBook for gradual rollouts of new features beyond the `OrganizationModule` binary on/off system. See Phase 11.16 for the full implementation.

Use it for:
- Rolling out AI features to beta testers only
- A/B testing pricing page variants
- Gradually enabling background sync to a percentage of users

### 8.2 Module Dependency Validation
Before deactivating a module, check if other active modules depend on it:

```typescript
const MODULE_DEPENDENCIES: Record<string, string[]> = {
  'purchase-orders': ['inventory'],
  'service-bookings': ['customers'],
  'loyalty': ['customers', 'sales'],
  'debts': ['customers'],
}

function canDeactivate(moduleId: string, activeModules: string[]): string[] {
  const dependents = Object.entries(MODULE_DEPENDENCIES)
    .filter(([_, deps]) => deps.includes(moduleId))
    .map(([mod]) => mod)
    .filter(mod => activeModules.includes(mod))
  return dependents // if non-empty, block deactivation
}
```

### 8.3 Module Usage Metrics
Track which modules are actually being used to inform business decisions:

```typescript
// Track in PostHog
posthog.capture('module_feature_used', {
  module: 'purchase-orders',
  action: 'create_po',
  orgId,
  plan: org.plan,
})
```

---

## PHASE 9 — DEPLOYMENT & OPERATIONS

### 9.1 vercel.json
```json
{
  "framework": "nextjs",
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/cron/check-expiries", "schedule": "0 21 * * *" },
    { "path": "/api/cron/cleanup-sessions", "schedule": "0 22 * * *" },
    { "path": "/api/cron/cleanup-errors", "schedule": "0 23 * * 0" }
  ],
  "rewrites": [
    { "source": "/ingest/static/:path(.*)", "destination": "https://us-assets.i.posthog.com/static/:path" },
    { "source": "/ingest/array/:path(.*)", "destination": "https://us-assets.i.posthog.com/array/:path" },
    { "source": "/ingest/:path(.*)", "destination": "https://us.i.posthog.com/:path" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

Note: All cron schedules are UTC. Ethiopia is UTC+3 — so `0 21 * * *` UTC = midnight Ethiopia time. See Phase 11.12.

### 9.2 CI/CD Pipeline
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run type-check
      - run: bun run lint
      - run: bun run test
      - run: bun run build

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps
      - run: bun run test:e2e
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
```

### 9.3 Database Backup Verification
Enable Supabase PITR (Point in Time Recovery) in the dashboard. Beyond automated backups, do a quarterly restore drill:
1. Pick a timestamp from 7 days ago
2. Restore to a shadow project
3. Verify data integrity with a count query
4. Delete the shadow project

If you cannot restore from backup, you do not have a backup.

### 9.4 Deployment Checklist
```
□ DATABASE_URL uses Supavisor pooled URL (port 6543) with pgbouncer=true
□ DIRECT_URL uses direct connection URL (port 5432)
□ TOTP_ENCRYPTION_KEY set (64-char hex: openssl rand -hex 32)
□ CRON_SECRET set and required in all cron routes
□ JWT_SECRET is ≥ 64 random bytes
□ CHAPA_WEBHOOK_SECRET set in both Chapa dashboard and .env
□ Supabase RLS enabled on all tables
□ Supabase PITR enabled
□ reactStrictMode: true in next.config.ts
□ Serwist config has reloadOnOnline: false
□ instrumentation.ts at project root (Sentry App Router support)
□ app/global-error.tsx exists
□ vercel.json has /ingest/* rewrites for PostHog
□ vercel.json has crons with UTC+3 offset for Ethiopia
□ ChapaWebhookEvent table has @unique on txRef
□ No createServerClient() at module level
□ All getSession() replaced with getUser() for authorization
□ Sentry alert rules configured (5 errors/min threshold)
□ Log Drain configured in Vercel → Axiom
□ /api/health/ready returns 200 before cutting traffic
□ Artillery load test passes (p95 < 500ms at 50 concurrent users)
□ All cron routes require CRON_SECRET
□ Email verification flow works end-to-end
□ Password reset flow works end-to-end
□ TOTP setup and verify works end-to-end
□ Chapa test webhook received and processed correctly
□ Offline mode: create a sale offline, reconnect, verify it synced
□ Conflict indicator shown after simulated offline conflict
```

---

## PHASE 10 — TESTING

### 10.1 Test Architecture
Use two separate test runners:
- **Vitest** — unit and integration tests (API route handlers, utility functions, Zod schemas)
- **Playwright** — end-to-end tests (full user flows in a real browser)

Note: Next.js App Router Server Components cannot be tested with Vitest — they require a real Next.js server. Test them with Playwright.

Install: `bun add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event playwright @playwright/test`

### 10.2 Critical Test Cases

**Unit tests (Vitest):**
```typescript
// Rate limiting — verify it actually blocks
test('rate limiter blocks after limit exceeded', async () => {
  for (let i = 0; i < 5; i++) {
    await checkRateLimit('auth', 'test-ip')
  }
  const result = await checkRateLimit('auth', 'test-ip')
  expect(result.success).toBe(false)
})

// Chapa webhook signature verification
test('rejects webhook with wrong signature', async () => {
  const req = new Request('/api/webhooks/chapa', {
    method: 'POST',
    body: '{"tx_ref":"test","status":"success"}',
    headers: { 'x-chapa-signature': 'wrong-signature' }
  })
  const res = await POST(req)
  expect(res.status).toBe(401)
})

// Soft delete — verify deleted products don't appear in lists
test('deleted products excluded from findMany', async () => {
  await db.product.create({ data: { ...productData, deletedAt: new Date() } })
  const products = await db.product.findMany({ where: { organizationId } })
  expect(products).toHaveLength(0)
})
```

**E2E tests (Playwright):**
```typescript
// Critical: complete sale flow
test('cashier can create a sale and stock decrements', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'cashier@test.com')
  await page.fill('[name=password]', 'password123')
  await page.click('[type=submit]')
  
  await page.goto('/sales/new')
  await page.fill('[placeholder="Search products"]', 'Test Product')
  await page.click('[data-product-id]')
  await page.fill('[name=quantity]', '2')
  await page.click('[data-testid=complete-sale]')
  
  await expect(page.getByText('Sale completed')).toBeVisible()
  
  // Verify stock decremented
  await page.goto('/products')
  await expect(page.getByText('Stock: 98')).toBeVisible() // was 100
})

// Critical: offline sale sync
test('sale created offline syncs on reconnect', async ({ page, context }) => {
  await page.goto('/sales/new')
  await context.setOffline(true)
  
  // Create sale while offline
  await page.fill('[placeholder="Search products"]', 'Test Product')
  await page.click('[data-product-id]')
  await page.click('[data-testid=complete-sale]')
  await expect(page.getByText('Saved offline')).toBeVisible()
  
  // Go online
  await context.setOffline(false)
  await expect(page.getByText('Synced')).toBeVisible({ timeout: 10000 })
})
```

### 10.3 Load Testing
See Phase 11.14 for Artillery setup. Run before every major release.

---

## PHASE 11 — ONLINE RESEARCH FINDINGS (Critical Additions & Corrections)

### 11.1 CRITICAL — Supabase Client Initialization Bug

On Vercel Fluid compute, warm instances are reused across requests. A Supabase client created at module scope caches the first user's cookies and serves them to all subsequent users — User A's session bleeds into User B's requests.

Search your entire codebase for:
```
createServerClient(
```
Every call that is NOT inside a function body must be moved inside one.

```typescript
// WRONG — module level, shared across all requests
const supabase = createServerClient(url, key, { cookies })

export async function GET(req: Request) {
  const { data } = await supabase.auth.getUser() // returns wrong user!
}

// CORRECT — created fresh per request
export async function GET(req: Request) {
  const supabase = createServerClient(url, key, { cookies: cookieAdapter(req) })
  const { data } = await supabase.auth.getUser()
}
```

Also replace every `supabase.auth.getSession()` used for authorization with `supabase.auth.getUser()`.

Also add to all auth responses:
```typescript
response.headers.set('Cache-Control', 'private, no-store')
```

### 11.2 Prisma Two-URL Pattern — Mandatory for Supabase

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Supavisor pooled, port 6543
  directUrl = env("DIRECT_URL")     // Direct connection, port 5432
}
```

```env
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&pool_timeout=30"
DIRECT_URL="postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres"
```

`directUrl` is mandatory. Without it, `prisma migrate deploy` times out under load because Prisma CLI uses sequential connections that are incompatible with PgBouncer transaction mode.

### 11.3 Upstash Rate Limiting — Use Their Dedicated Package

Install: `bun add @upstash/ratelimit @upstash/redis`

```typescript
// src/lib/rate-limit-redis.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv() // reads UPSTASH_REDIS_REST_URL + TOKEN automatically

export const rateLimiters = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'rl:auth',
  }),
  mutation: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
    prefix: 'rl:mutation',
  }),
  list: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'rl:list',
  }),
  dashboard: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'rl:dashboard',
  }),
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'rl:ai',
  }),
}

export async function checkRateLimit(
  limiter: keyof typeof rateLimiters,
  identifier: string
) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { success: true, remaining: 999, reset: new Date() }
  }
  return rateLimiters[limiter].limit(identifier)
}
```

Move auth rate limiting to Next.js Middleware (runs at Edge before serverless functions):

```typescript
// middleware.ts — add for auth routes
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { ipAddress } from '@vercel/edge'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
})

// Inside middleware function:
if (request.nextUrl.pathname.startsWith('/api/auth/')) {
  const ip = ipAddress(request) ?? 'anonymous'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }
}
```

### 11.4 TOTP Secret Encryption — AES-256-GCM

No extra dependencies needed — use Node's built-in `crypto`:

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, 'hex') // 32 bytes = 64 hex chars

export function encryptTotpSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, encrypted].map(b => b.toString('base64')).join(':')
}

export function decryptTotpSecret(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

Write a one-time migration script to encrypt existing plaintext secrets in the database.

### 11.5 Supabase RLS — Enable and Index Properly

Create `prisma/migrations/enable_rls/migration.sql`:
```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Debt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;

-- Index every column used in RLS policies
CREATE INDEX IF NOT EXISTS idx_org_member_user_id ON "OrganizationMember"("userId");
CREATE INDEX IF NOT EXISTS idx_org_member_org_id ON "OrganizationMember"("organizationId");

-- Example policy using (select auth.uid()) pattern for performance
-- The (select ...) subquery is evaluated ONCE, not per row
CREATE POLICY "members_read_own_org_products"
  ON "Product" FOR SELECT TO authenticated
  USING (
    "organizationId" IN (
      SELECT "organizationId" FROM "OrganizationMember"
      WHERE "userId" = (select auth.uid())
    )
  );
```

### 11.6 Serwist — Critical Configuration Fixes

**Fix 1:** Add `reloadOnOnline: false` to prevent form data loss:
```typescript
// next.config.ts
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: false, // prevents page reload when user reconnects mid-form
  disable: process.env.NODE_ENV === 'development',
})
```

**Fix 2:** Add new version available banner:
```typescript
// In app-shell or root layout
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setShowUpdateBanner(true)
    })
  }
}, [])

{showUpdateBanner && (
  <div className="fixed top-0 inset-x-0 z-50 bg-primary text-primary-foreground text-sm text-center py-2">
    A new version is available.{' '}
    <button onClick={() => window.location.reload()} className="underline font-medium">
      Refresh to update
    </button>
  </div>
)}
```

**Fix 3:** Background Sync Safari fallback:
```typescript
// src/lib/sync/online-fallback.ts
export function registerOnlineFallback() {
  window.addEventListener('online', async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) return // Chromium handles it
    // Safari fallback
    const pending = await db.outbox.where('status').equals('pending').toArray()
    if (pending.length > 0) {
      await replayOutbox()
    }
  })
}
```

### 11.7 Chapa Webhook — Idempotency Table

Add to `schema.prisma`:
```prisma
model ChapaWebhookEvent {
  id        String   @id @default(cuid())
  txRef     String   @unique  // @unique enforces idempotency at DB level
  status    String   // 'received' | 'fulfilled' | 'failed'
  payload   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([createdAt])
}
```

Chapa retries webhooks every 10 minutes for 72 hours — up to 432 deliveries per payment. The `@unique` constraint on `txRef` means concurrent duplicates are rejected with a unique constraint error (P2002), which you catch and return 200.

### 11.8 Supabase Realtime — Replace Socket.IO

Socket.IO cannot run on Vercel Serverless. Use Supabase Realtime instead:

```typescript
// src/lib/realtime.ts (client-side)
import { createClient } from '@/lib/supabase/client'

export function subscribeToOrgChanges(
  orgId: string,
  onProductChange: (payload: unknown) => void,
  onSaleChange: (payload: unknown) => void,
) {
  const supabase = createClient()
  
  const channel = supabase
    .channel(`org:${orgId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'Product',
      filter: `organizationId=eq.${orgId}`,
    }, onProductChange)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'Sale',
      filter: `organizationId=eq.${orgId}`,
    }, onSaleChange)
    .subscribe()

  return () => supabase.removeChannel(channel)
}
```

For notifications: write to a `Notification` table via API route → Supabase Realtime delivers it automatically to all subscribed clients. Remove Socket.IO from `package.json`.

### 11.9 Sentry — App Router Specific Setup

Create `instrumentation.ts` at the project root (not in `src/`):
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
```

Create `app/global-error.tsx`:
```typescript
'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <button onClick={reset} className="px-4 py-2 bg-primary text-white rounded">
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
```

### 11.10 Pino Structured Logging

Install: `bun add pino pino-pretty`

```typescript
// src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'invensync',
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
})
```

Set up a Vercel Log Drain to Axiom (free tier: 30 days retention): Vercel dashboard → Settings → Log Drains → Axiom.

### 11.11 PostHog Analytics Setup

Install: `bun add posthog-js posthog-node`

```typescript
// src/providers/posthog.tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: '/ingest', // proxied via Vercel to bypass adblockers
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
    })
  }, [])
  
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
```

Add proxy rewrites to `vercel.json` (see Phase 9.1). Track key business events:
```typescript
posthog.capture('sale_created', { total, itemCount, paymentMethod, orgId })
posthog.capture('module_activated', { moduleId, plan, orgId })
posthog.capture('offline_session_started', { pendingOutboxCount })
```

### 11.12 Vercel Cron — Ethiopia Timezone

Vercel cron uses UTC. Ethiopia is UTC+3. All cron schedules must subtract 3 hours:

| Desired Ethiopia time | UTC cron expression |
|---|---|
| Midnight daily | `0 21 * * *` |
| 1am daily | `0 22 * * *` |
| 2am Sunday | `0 23 * * 0` |

Make all cron handlers idempotent — Vercel cron is best-effort and can duplicate:
```typescript
const today = new Date().toISOString().split('T')[0]
const alreadyRan = await redis.get(`cron:check-expiries:${today}`)
if (alreadyRan) return NextResponse.json({ skipped: true })
await redis.set(`cron:check-expiries:${today}`, '1', { ex: 86400 })
```

### 11.13 Prisma Soft Delete Extension

Install: `bun add prisma-extension-soft-delete`

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { createSoftDeleteExtension } from 'prisma-extension-soft-delete'

const prismaBase = new PrismaClient()

export const db = prismaBase.$extends(
  createSoftDeleteExtension({
    models: {
      Product: true,
      Customer: true,
      Supplier: true,
    },
    defaultConfig: {
      field: 'deletedAt',
      createValue: (deleted) => (deleted ? new Date() : null),
    },
  })
)
```

The extension automatically adds `WHERE deletedAt IS NULL` to every `findMany`, `findFirst`, `findUnique`, and `count` query. Add `deletedAt DateTime?` to Product, Customer, and Supplier in `schema.prisma`.

### 11.14 Load Testing with Artillery

Install: `bun add -D artillery @artillery/plugin-expect`

Create `load-tests/sale-creation.yml`:
```yaml
config:
  target: "https://your-app.vercel.app"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 20
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Spike"
  plugins:
    expect: {}
  defaults:
    headers:
      Authorization: "Bearer {{ $env.TEST_AUTH_TOKEN }}"
      Content-Type: "application/json"

scenarios:
  - name: "Create sale"
    flow:
      - post:
          url: "/api/sales"
          json:
            orgId: "{{ $env.TEST_ORG_ID }}"
            items:
              - productId: "{{ $env.TEST_PRODUCT_ID }}"
                quantity: 1
          expect:
            - statusCode: 201

  - name: "Dashboard load"
    flow:
      - get:
          url: "/api/dashboard?orgId={{ $env.TEST_ORG_ID }}"
          expect:
            - statusCode: 200
            - maxResponseTime: 1000
```

Add to `package.json`: `"load-test": "artillery run load-tests/sale-creation.yml"`

### 11.15 Cursor-Based Pagination

Replace offset pagination on all list endpoints:

```typescript
// GET /api/products?cursor=clxyz123&limit=50
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  const products = await db.product.findMany({
    where: { organizationId: orgId, deletedAt: null },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  const hasNextPage = products.length > limit
  const items = hasNextPage ? products.slice(0, -1) : products
  const nextCursor = hasNextPage ? items[items.length - 1].id : null

  return NextResponse.json({ items, nextCursor, hasNextPage })
}
```

On the client with TanStack Query `useInfiniteQuery`:
```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['products', orgId],
  queryFn: ({ pageParam }) =>
    fetch(`/api/products?cursor=${pageParam}&limit=50`).then(r => r.json()),
  initialPageParam: undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

Apply to: products, sales, customers, expenses, debts, suppliers.

### 11.16 GrowthBook Feature Flags

Install: `bun add @growthbook/growthbook`

```typescript
// src/lib/growthbook.ts
import { GrowthBook } from '@growthbook/growthbook'

export function createGrowthBook(attrs: {
  userId: string
  orgId: string
  plan: string
}) {
  return new GrowthBook({
    apiHost: process.env.GROWTHBOOK_API_HOST ?? 'https://cdn.growthbook.io',
    clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY!,
    attributes: attrs,
    trackingCallback: (experiment, result) => {
      posthog.capture('$experiment_started', {
        experiment_name: experiment.key,
        variant: result.key,
      })
    },
  })
}

// In a Server Component
const gb = createGrowthBook({ userId, orgId, plan: org.plan })
await gb.loadFeatures({ timeout: 1000 })

if (gb.isOn('ai-assistant')) {
  return <AIAssistantPage />
}
return <UpgradeCTA />
```

GrowthBook evaluates flags locally — no network call at feature check time, safe on hot paths.

---

## FINAL DEPLOYMENT CHECKLIST (Complete)

```
□ DATABASE_URL uses Supavisor pooled URL (port 6543) with pgbouncer=true
□ DIRECT_URL uses direct connection URL (port 5432)
□ TOTP_ENCRYPTION_KEY set (64-char hex: openssl rand -hex 32)
□ JWT_SECRET is ≥ 64 random bytes
□ CRON_SECRET set; all cron routes require it with no open fallback
□ CHAPA_WEBHOOK_SECRET set in both Chapa dashboard and .env
□ UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set
□ Supabase RLS enabled on all tenant tables
□ Supabase PITR enabled (Settings → Database → Point in Time Recovery)
□ reactStrictMode: true in next.config.ts
□ Serwist config has reloadOnOnline: false
□ instrumentation.ts at project root (for Sentry App Router support)
□ app/global-error.tsx exists
□ vercel.json has /ingest/* rewrites for PostHog
□ vercel.json crons use UTC-3 offsets for Ethiopia local time
□ ChapaWebhookEvent table has @unique on txRef
□ No createServerClient() at module level (grep the whole codebase)
□ All getSession() replaced with getUser() for authorization
□ Email verification flow works end-to-end
□ Password reset flow works end-to-end
□ TOTP setup and verify and backup codes work end-to-end
□ Existing TOTP secrets encrypted with AES-256-GCM migration
□ Chapa test webhook received and processed correctly
□ Offline: create a sale offline → reconnect → verify synced to server
□ Conflict log appears after simulated offline conflict
□ New version banner appears after SW update
□ Safari offline sync works (online event fallback)
□ Sentry alert rules configured (5 errors/min threshold)
□ Log Drain configured in Vercel → Axiom
□ /api/health/ready returns 200 before cutting traffic
□ Artillery load test passes (p95 < 500ms at 50 concurrent users)
□ All list endpoints use cursor-based pagination
□ Soft delete active on Product, Customer, Supplier
□ Backup restore drill completed (quarterly)
```

---

*End of InvenSync Production Improvement Prompt — Phases 0 through 11*
