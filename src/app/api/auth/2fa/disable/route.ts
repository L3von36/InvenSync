import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { verifyTotpCode, verifyBackupCode, hashBackupCode } from '@/lib/two-factor'
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

    if (!dbUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled.' },
        { status: 400 }
      )
    }

    // Verify the code (TOTP or backup code)
    let isValidTotp = false
    let isValidBackup = false

    if (dbUser.twoFactorSecret) {
      isValidTotp = verifyTotpCode(dbUser.twoFactorSecret, code)
    }

    if (!isValidTotp && dbUser.backupCodes) {
      const hashedCodes: string[] = JSON.parse(dbUser.backupCodes)
      isValidBackup = verifyBackupCode(code, hashedCodes)

      // Remove used backup code
      if (isValidBackup) {
        const usedHash = hashBackupCode(code)
        const remainingCodes = hashedCodes.filter(h => h !== usedHash)
        await db.user.update({
          where: { id: userId },
          data: { backupCodes: JSON.stringify(remainingCodes) },
        })
      }
    }

    if (!isValidTotp && !isValidBackup) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      )
    }

    // Disable 2FA
    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('2FA disable error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
