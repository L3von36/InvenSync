import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { comparePassword, createSession, hashPassword, DatabaseUnavailableError } from '@/lib/auth'
import { generateTempToken, parseUserAgent } from '@/lib/two-factor'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// Account lockout constants
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: Request) {
  // Rate limit auth endpoints (5 req/min per IP)
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.AUTH)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    let body: { email?: string; password?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase().trim()

    // Look up user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!user) {
      // Use generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60000)
      return NextResponse.json(
        { error: `Account is temporarily locked due to too many failed attempts. Please try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` },
        { status: 423 }
      )
    }

    // If lockout has expired, reset the counter
    if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      })
      user.failedLoginAttempts = 0
      user.lockedUntil = null
    }

    // If user has no password set (e.g., created via Supabase Auth only),
    // they must reset their password or use their original auth method.
    // Do NOT auto-set the password — that would allow account takeover.
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Account not configured for password login. Please reset your password or contact support.' },
        { status: 401 }
      )
    }

    // Verify password using bcrypt
    const isValid = await comparePassword(password, user.passwordHash)
    if (!isValid) {
      // Increment failed login attempts
      const newAttempts = (user.failedLoginAttempts || 0) + 1
      const lockoutData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newAttempts,
      }

      // Lock account if max attempts reached
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        lockoutData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
      }

      await db.user.update({
        where: { id: user.id },
        data: lockoutData,
      })

      const remainingAttempts = MAX_FAILED_ATTEMPTS - newAttempts
      if (remainingAttempts <= 0) {
        return NextResponse.json(
          { error: `Account locked due to too many failed attempts. Please try again in 15 minutes.` },
          { status: 423 }
        )
      }

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Reset failed login attempts on successful password verification
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      })
    }

    // Check if 2FA is enabled for this user
    if (user.twoFactorEnabled) {
      // Generate a temporary token for the 2FA verification step
      const tempToken = generateTempToken(user.id)

      if (process.env.NODE_ENV !== 'production') console.log('[Login] 2FA required')

      return NextResponse.json({
        requires2FA: true,
        tempToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      })
    }

    if (process.env.NODE_ENV !== 'production') console.log('[Login] Successful login')

    const token = await createSession(user.id)

    // Track device
    await trackDevice(request, user.id)

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
    console.error('Login error:', error)

    // Handle database unavailability — return 503, NOT 401
    // This prevents the client auto-logout cascade when DB is temporarily down
    if (error instanceof DatabaseUnavailableError || isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Track user device on login.
 */
async function trackDevice(request: Request, userId: string) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0]?.trim() || realIp || null

    const parsed = parseUserAgent(userAgent)

    // Check if this device already exists (same userId, browser, os)
    const existingDevice = await db.userDevice.findFirst({
      where: {
        userId,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.deviceType,
        isActive: true,
      },
    })

    if (existingDevice) {
      // Update last active time
      await db.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastActiveAt: new Date(),
          ipAddress,
        },
      })
    } else {
      // Create new device record
      await db.userDevice.create({
        data: {
          userId,
          deviceName: parsed.deviceName,
          deviceType: parsed.deviceType,
          browser: parsed.browser,
          os: parsed.os,
          ipAddress,
        },
      })
    }
  } catch (err) {
    // Don't fail login if device tracking fails
    if (process.env.NODE_ENV !== 'production') console.error('[Login] Device tracking error:', err)
  }
}
