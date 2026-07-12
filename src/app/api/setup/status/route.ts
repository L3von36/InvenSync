import { NextResponse, type NextRequest } from 'next/server'
import { isDatabaseError } from '@/lib/api-error'

interface DatabaseInfo {
  status: 'connected' | 'unreachable' | 'schema_missing' | 'auth_failed'
  tableCount: number
  provider: string
  error?: string
}

export async function GET(request: NextRequest) {
  // In production, return a healthy status — the DB is managed (Neon/Vercel)
  // and setup is not applicable. Returning 404 caused frontend infinite retry loops.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      supabase: {
        configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      database: {
        status: 'connected',
        tableCount: 0,
        provider: 'postgresql',
      },
      auth: {
        mode: 'jwt',
      },
    })
  }

  // Secret check for non-production
  const setupSecret = process.env.SETUP_SECRET || 'dev-only'
  const requestSecret = request.headers.get('x-setup-secret') || new URL(request.url).searchParams.get('secret')
  if (requestSecret !== setupSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isSupabaseConfigured =
    !!supabaseUrl &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !!supabaseAnonKey &&
    supabaseAnonKey !== 'your-anon-key'

  // Detect database provider from DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || ''
  const isSQLite = dbUrl.startsWith('file:')
  const provider = isSQLite ? 'sqlite' : 'postgresql'

  let dbInfo: DatabaseInfo = {
    status: 'unreachable',
    tableCount: 0,
    provider,
  }

  // Check database connectivity regardless of Supabase config
  try {
    const { db } = await import('@/lib/prisma')
    await db.$queryRaw`SELECT 1`

    let tableCount = 0
    let existingTables: string[] = []

    if (isSQLite) {
      // SQLite: query sqlite_master for table names
      const tables = await db.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'
      ` as Array<{ name: string }>
      tableCount = tables.length
      existingTables = tables.map((t) => t.name)
    } else {
      // PostgreSQL: query pg_tables
      const tables = await db.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      ` as Array<{ tablename: string }>
      tableCount = tables.length
      existingTables = tables.map((t) => t.tablename)
    }

    // Check for required tables (SQLite tables are case-sensitive, Prisma uses PascalCase)
    const requiredTables = isSQLite
      ? ['User', 'Organization', 'Shop']
      : ['User', 'Organization', 'Shop']
    const hasRequired = requiredTables.every((t) =>
      existingTables.some((et) => et.toLowerCase() === t.toLowerCase())
    )

    dbInfo = {
      status: hasRequired ? 'connected' : 'schema_missing',
      tableCount,
      provider,
    }
  } catch (error: unknown) {
    if (isDatabaseError(error)) {
      return NextResponse.json({
        supabase: {
          configured: isSupabaseConfigured,
          url: supabaseUrl || null,
          hasAnonKey: !!supabaseAnonKey,
        },
        database: {
          status: 'unreachable',
          tableCount: 0,
          provider,
          error: 'Service temporarily unavailable. Please try again.',
        },
        auth: {
          mode: isSupabaseConfigured ? 'supabase' : 'jwt',
        },
      }, { status: 503 })
    }
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check for authentication failures — Prisma P1000 or PostgreSQL auth errors
    const isAuthFailed =
      errorMessage.includes('P1000') ||
      errorMessage.includes('authentication failed') ||
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('password authentication failed') ||
      errorMessage.includes('28P01') // PostgreSQL auth error code

    if (isAuthFailed) {
      dbInfo = {
        status: 'auth_failed',
        tableCount: 0,
        provider,
        error:
          'Database password is incorrect. Verify your DATABASE_URL password in the Supabase Dashboard under Settings → Database, and update your .env file.',
      }
    } else {
      dbInfo = {
        status: 'unreachable',
        tableCount: 0,
        provider,
        error: 'Unable to connect to the database. Please check your connection settings.',
        ...(process.env.NODE_ENV === 'development' ? { detail: errorMessage } : {}),
      }
    }
  }

  return NextResponse.json({
    supabase: {
      configured: isSupabaseConfigured,
      url: supabaseUrl || null,
      hasAnonKey: !!supabaseAnonKey,
    },
    database: dbInfo,
    auth: {
      mode: isSupabaseConfigured ? 'supabase' : 'jwt',
    },
  })
}
