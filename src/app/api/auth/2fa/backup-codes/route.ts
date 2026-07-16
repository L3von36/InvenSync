// Regenerate 2FA backup codes. Requires a valid current TOTP code so a
// stolen session alone can't mint fresh codes. Invalidates all previous
// backup codes. (The old UI called the setup endpoint for this, which
// always rejects once 2FA is enabled — this route is the real path.)
import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { verifyTotpCode, generateBackupCodes, hashBackupCode } from '@/lib/two-factor'
import { decryptSecret } from '@/lib/crypto'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

export async function POST(request: Request) {
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

    const { code } = body
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })

    if (!dbUser?.twoFactorEnabled || !dbUser.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled.' },
        { status: 400 }
      )
    }

    // Only a current TOTP code works here — deliberately NOT backup codes,
    // since regenerating with a backup code would let one leaked code mint
    // eight fresh ones.
    const isValid = verifyTotpCode(decryptSecret(dbUser.twoFactorSecret), code)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please enter the current code from your authenticator app.' },
        { status: 401 }
      )
    }

    const backupCodes = generateBackupCodes()
    const hashedBackupCodes = backupCodes.map(c => hashBackupCode(c))

    await db.user.update({
      where: { id: user.id },
      data: { backupCodes: JSON.stringify(hashedBackupCodes) },
    })

    return NextResponse.json({
      success: true,
      backupCodes, // plain codes returned once so the user can save them
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('2FA backup code regeneration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
