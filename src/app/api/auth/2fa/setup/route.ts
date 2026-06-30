import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { generateTotpSecret, hashBackupCode } from '@/lib/two-factor'
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

    // Check if 2FA is already enabled
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (dbUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled. Disable it first to set up again.' },
        { status: 400 }
      )
    }

    // Generate TOTP secret and backup codes
    const { secret, qrCodeUrl, backupCodes } = generateTotpSecret(user.id, user.email)

    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code))

    // Save secret and hashed backup codes to user (not enabled yet — must verify first)
    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        backupCodes: JSON.stringify(hashedBackupCodes),
      },
    })

    return NextResponse.json({
      qrCodeUrl,
      backupCodes, // Return plain codes so user can save them
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
