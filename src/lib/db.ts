import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: getPooledUrl(),
      },
    },
  })
}

/**
 * In serverless environments (Vercel), DATABASE_URL may point to the
 * direct connection (port 5432) which has very limited connection slots.
 *
 * This function automatically converts a direct Supabase pooler URL to
 * the PgBouncer connection-pooling URL (port 6543) when running in
 * a serverless environment.
 */
function getPooledUrl(): string | undefined {
  let url = process.env.DATABASE_URL
  if (!url) return undefined

  // If already using pgbouncer, return as-is
  if (url.includes('pgbouncer=true') || url.includes(':6543')) {
    return url
  }

  // In production/serverless, auto-convert pooler.supabase.com:5432 to :6543
  if (process.env.VERCEL === '1' && url.includes('pooler.supabase.com')) {
    url = url
      .replace('pooler.supabase.com:5432', 'pooler.supabase.com:6543')
      .replace('/postgres', '/postgres?pgbouncer=true&connection_limit=1')
    console.log('[DB] Auto-switched to PgBouncer pooler URL for Vercel serverless')
    return url
  }

  return url
}

// Use existing client in dev to avoid creating multiple connections
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
