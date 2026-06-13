import { NextResponse, type NextRequest } from 'next/server'
import { isDatabaseError } from '@/lib/api-error'

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
    const { execSync } = await import('child_process')
    const output = execSync('bun run db:seed 2>&1', {
      cwd: '/home/z/my-project',
      timeout: 120000,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Database seeded successfully',
      output: output.toString().slice(-500),
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
      error instanceof Error ? error.message : 'Failed to seed database'

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to seed the database. Please try again.',
        ...(process.env.NODE_ENV === 'development' ? { detail: message } : {}),
      },
      { status: 500 }
    )
  }
}
