import { NextResponse } from 'next/server'
import { isDatabaseError } from '@/lib/api-error'

export async function POST() {
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
