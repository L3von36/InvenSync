import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { verifyTempToken, verifyTotpCode, verifyBackupCode, hashBackupCode, parseUserAgent } from '@/lib/two-factor'
import { decryptSecret } from '@/lib/crypto'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.AUTH)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { tempToken, code } = body

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: 'Temporary token and verification code are required' },
        { status: 400 }
      )
    }

    // Verify the temporary token
    const userId = verifyTempToken(tempToken)
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please log in again.' },
        { status: 401 }
      )
    }

    // Look up the user
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled for this account.' },
        { status: 400 }
      )
    }

    // Verify the TOTP code or backup code
    let isValidTotp = verifyTotpCode(decryptSecret(user.twoFactorSecret), code)
    let isValidBackup = false

    if (!isValidTotp && user.backupCodes) {
      const hashedCodes: string[] = JSON.parse(user.backupCodes)
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
        { status: 401 }
      )
    }

    // Create session — session-backed JWT (revocable server-side)
    const token = await createSession(user.id)

    // Track device
    try {
      const userAgent = request.headers.get('user-agent') || ''
      const forwarded = request.headers.get('x-forwarded-for')
      const realIp = request.headers.get('x-real-ip')
      const ipAddress = forwarded?.split(',')[0]?.trim() || realIp || null
      const parsed = parseUserAgent(userAgent)

      const existingDevice = await db.userDevice.findFirst({
        where: {
          userId: user.id,
          browser: parsed.browser,
          os: parsed.os,
          deviceType: parsed.deviceType,
          isActive: true,
        },
      })

      if (existingDevice) {
        await db.userDevice.update({
          where: { id: existingDevice.id },
          data: { lastActiveAt: new Date(), ipAddress },
        })
      } else {
        await db.userDevice.create({
          data: {
            userId: user.id,
            deviceName: parsed.deviceName,
            deviceType: parsed.deviceType,
            browser: parsed.browser,
            os: parsed.os,
            ipAddress,
          },
        })
      }
    } catch (err) {
      console.error('[2FA Login] Device tracking error:', err)
    }

    console.log(`[2FA Login] Successful 2FA login for: ${user.email}`)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      organizations: user.memberships.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        currency: m.organization.currency,
        country: m.organization.country,
        businessType: m.organization.businessType,
        city: m.organization.city,
      }))
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('2FA login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
