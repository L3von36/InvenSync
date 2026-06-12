import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { verifyTotpCode, verifyBackupCode } from '@/lib/two-factor'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.AUTH)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { userId, code } = body

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'User ID and verification code are required' },
        { status: 400 }
      )
    }

    // Ensure the requesting user matches
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        backupCodes: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!dbUser.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication has not been set up. Please set up 2FA first.' },
        { status: 400 }
      )
    }

    if (dbUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled.' },
        { status: 400 }
      )
    }

    // Verify the TOTP code
    const isValid = verifyTotpCode(dbUser.twoFactorSecret, code)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      )
    }

    // Enable 2FA
    await db.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('2FA verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
