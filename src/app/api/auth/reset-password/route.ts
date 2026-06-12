import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hashPassword, comparePassword } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

/**
 * POST /api/auth/reset-password
 *
 * Allows an authenticated user to change their own password,
 * or allows resetting a password with email + current password verification.
 *
 * Body:
 *   - email + currentPassword + newPassword  (self-service reset)
 */
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

    const { email, currentPassword, newPassword } = body

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Email, current password, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await db.user.findFirst({
      where: { email: email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify current password
    if (!user.passwordHash || user.passwordHash === '') {
      return NextResponse.json(
        { error: 'Account does not have a password set. Please contact support.' },
        { status: 400 }
      )
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash and update the new password
    const newPasswordHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash }
    })

    console.log(`[ResetPassword] Password reset successfully for: ${email}`)

    return NextResponse.json({
      message: 'Password reset successfully'
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
