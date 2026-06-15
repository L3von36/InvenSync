import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/prisma'
import { isDatabaseError } from '@/lib/api-error'

// Detect database provider from DATABASE_URL
const dbUrl = process.env.DATABASE_URL || ''
const isSQLite = dbUrl.startsWith('file:')

async function getTableNames(): Promise<string[]> {
  if (isSQLite) {
    const tables = await db.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'
    ` as Array<{ name: string }>
    return tables.map((t) => t.name)
  }
  const tables = await db.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ` as Array<{ tablename: string }>
  return tables.map((t) => t.tablename)
}

export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  // Secret check for non-production
  const setupSecret = process.env.SETUP_SECRET || 'dev-only'
  const requestSecret = request.headers.get('x-setup-secret') || new URL(request.url).searchParams.get('secret')
  if (requestSecret !== setupSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`

    // Check if tables exist
    const existingTables = await getTableNames()

    const requiredTables = [
      'User',
      'Organization',
      'Shop',
      'Product',
      'Sale',
      'Module',
    ]
    const missingTables = requiredTables.filter(
      (t) => !existingTables.some((et) => et.toLowerCase() === t.toLowerCase())
    )

    if (missingTables.length === 0) {
      return NextResponse.json({
        status: 'ready',
        message: 'Database is set up and ready',
        tableCount: existingTables.length,
        tables: existingTables,
      })
    }

    return NextResponse.json({
      status: 'schema_missing',
      message: 'Database is reachable but schema is not set up',
      missingTables,
      instructions:
        'Run the migration SQL in your Supabase SQL Editor, or use POST /api/setup/database to push the schema automatically.',
    })
  } catch (error: unknown) {
    if (isDatabaseError(error)) {
      return NextResponse.json({
        status: 'unreachable',
        message: 'Service temporarily unavailable. Please try again.',
      }, { status: 503 })
    }
    const message =
      error instanceof Error ? error.message : 'Unknown database error'

    return NextResponse.json({
      status: 'unreachable',
      message: 'Unable to connect to the database. Please check your connection settings.',
      ...(process.env.NODE_ENV === 'development' ? { detail: message } : {}),
      instructions: isSQLite
        ? [
            '1. Ensure the SQLite database file exists at the path specified in DATABASE_URL',
            '2. Run `bunx prisma db push` to create the schema',
            '3. Run `bun prisma/seed.ts` to seed the database',
            '4. Restart the application',
          ]
        : [
            '1. Go to your Supabase Dashboard → SQL Editor',
            '2. Copy and paste the migration SQL from supabase-migration.sql',
            '3. Run the SQL to create all tables',
            '4. Go to Project Settings → Database → Connection Pooling',
            '5. Enable connection pooling (Supavisor)',
            '6. Update your .env with the pooler connection string',
            '7. Restart the application',
          ],
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  // Secret check for non-production
  const setupSecret = process.env.SETUP_SECRET || 'dev-only'
  const requestSecret = request.headers.get('x-setup-secret') || new URL(request.url).searchParams.get('secret')
  if (requestSecret !== setupSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use dynamic import for child_process to work with Next.js bundling
    const { execSync } = await import('child_process')
    const output = execSync('npx prisma db push --accept-data-loss 2>&1', {
      cwd: '/home/z/my-project',
      timeout: 60000,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Schema pushed to database',
      output: output.toString(),
    })
  } catch (error: unknown) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Service temporarily unavailable. Please try again.',
        },
        { status: 503 }
      )
    }
    const message =
      error instanceof Error ? error.message : 'Failed to push schema'

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to push schema. Please try again.',
        ...(process.env.NODE_ENV === 'development' ? { detail: message } : {}),
      },
      { status: 500 }
    )
  }
}
