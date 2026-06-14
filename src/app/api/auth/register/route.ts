import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken, validatePasswordStrength } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'
import { seedBusinessTemplate } from '@/lib/seed-business-template'
import { VALID_BUSINESS_TYPES, mapLegacyBusinessType } from '@/lib/business-templates'

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

    const {
      email, name, password, organizationName,
      businessType, description, address, city,
      latitude, longitude, phone, salesRepId, referralCode
    } = body

    // Sanitize text inputs
    const sanitizedName = sanitizeAndTruncate(name, 255)
    const sanitizedOrganizationName = sanitizeAndTruncate(organizationName, 255)
    const sanitizedDescription = description ? sanitizeAndTruncate(description, 1000) : description
    const sanitizedAddress = address ? sanitizeAndTruncate(address, 500) : address
    const sanitizedCity = city ? sanitizeAndTruncate(city, 100) : city
    const sanitizedPhone = phone ? sanitizeAndTruncate(phone, 50) : phone

    if (!email || !sanitizedName || !password || !sanitizedOrganizationName) {
      return NextResponse.json(
        { error: 'Email, name, password, and organization name are required' },
        { status: 400 }
      )
    }

    // Validate sanitized fields are not empty after sanitization
    const nameError = validateSanitizedField(name, sanitizedName, 'Name')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    const orgNameError = validateSanitizedField(organizationName, sanitizedOrganizationName, 'Organization name')
    if (orgNameError) {
      return NextResponse.json({ error: orgNameError }, { status: 400 })
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join('. ') },
        { status: 400 }
      )
    }

    // Normalize email to lowercase for case-insensitive uniqueness
    const normalizedEmail = email.toLowerCase().trim()

    const validBusinessTypes = [...VALID_BUSINESS_TYPES, 'retail', 'service', 'mixed']
    const resolvedBusinessType = validBusinessTypes.includes(businessType) ? businessType : 'general_retail'

    // Check if user already exists — block registration for ANY existing user
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in or reset your password.' },
        { status: 409 }
      )
    }

    // Generate slug from organization name
    const slug = sanitizedOrganizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

    // Check slug uniqueness
    const existingSlug = await db.organization.findUnique({ where: { slug } })
    if (existingSlug) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      )
    }

    // Resolve referralCode to a sales rep ID if provided
    let effectiveSalesRepId = salesRepId || null
    if (!effectiveSalesRepId && referralCode) {
      const refSalesRep = await db.salesRep.findUnique({
        where: { id: referralCode },
        include: { user: true }
      })
      if (refSalesRep && refSalesRep.isActive) {
        effectiveSalesRepId = refSalesRep.id
      }
    }

    // Hash the password with bcrypt
    const passwordHash = await hashPassword(password)

    // Wrap the entire registration flow in a transaction to prevent orphaned data
    // (e.g., user created but org fails, org created but membership fails, etc.)
    const { newUser, organization, salesRepName } = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: normalizedEmail, name: sanitizedName, passwordHash }
      })

      const organization = await tx.organization.create({
        data: {
          name: sanitizedOrganizationName,
          slug,
          businessType: resolvedBusinessType,
          description: sanitizedDescription || null,
          address: sanitizedAddress || null,
          city: sanitizedCity || null,
          latitude: latitude != null ? parseFloat(String(latitude)) : null,
          longitude: longitude != null ? parseFloat(String(longitude)) : null,
          phone: sanitizedPhone || null,
          referredById: effectiveSalesRepId || null,
        }
      })

      await tx.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: organization.id,
          role: 'owner'
        }
      })

      // Create default "Main Shop"
      const shop = await tx.shop.create({
        data: {
          organizationId: organization.id,
          name: 'Main Shop',
          address: sanitizedAddress || null,
          city: sanitizedCity || null,
          latitude: latitude != null ? parseFloat(String(latitude)) : null,
          longitude: longitude != null ? parseFloat(String(longitude)) : null,
          phone: sanitizedPhone || null,
        }
      })

      // Assign the owner as shop manager
      await tx.shopMember.create({
        data: {
          userId: newUser.id,
          shopId: shop.id,
          role: 'manager',
        }
      })

      // Activate only core free modules for the new org (clean sidebar)
      // Other modules must be requested by the user from the "My Modules" page
      // Free modules auto-activate on request; paid modules need admin approval
      const coreModuleKeys = ['inventory', 'sales', 'expenses']

      const coreModules = await tx.module.findMany({
        where: {
          isActive: true,
          key: { in: coreModuleKeys },
        }
      })

      for (const mod of coreModules) {
        await tx.organizationModule.create({
          data: {
            organizationId: organization.id,
            moduleId: mod.id,
            status: 'active',
            isActive: true,
            expiresAt: null, // Core free modules — permanent active status
            priceAtActivation: mod.priceETB,
            autoRenew: false,
          }
        })
      }

      // Seed business template — create default product types & attributes
      // based on the selected business type
      await seedBusinessTemplate(tx, organization.id, resolvedBusinessType)

      // Handle sales rep linking if provided
      let salesRepName: string | null = null
      if (effectiveSalesRepId) {
        const salesRep = await tx.salesRep.findUnique({
          where: { id: effectiveSalesRepId },
          include: { user: true }
        })

        if (!salesRep || !salesRep.isActive) {
          throw new Error('INVALID_SALES_REP')
        }

        // Create commission record for the referring sales rep
        await tx.salesCommission.create({
          data: {
            salesRepId: salesRep.id,
            organizationId: organization.id,
            amount: salesRep.commissionPerReg,
            status: 'pending',
          }
        })

        // Get or create current month's sales goal and increment achieved count
        const period = new Date().toISOString().slice(0, 7)
        const goal = await tx.salesGoal.upsert({
          where: {
            salesRepId_period: { salesRepId: salesRep.id, period }
          },
          create: {
            salesRepId: salesRep.id,
            period,
            targetCount: 0,
            achievedCount: 1,
          },
          update: {
            achievedCount: { increment: 1 },
          }
        })

        // Mark goal as achieved if target is met
        if (goal.achievedCount >= goal.targetCount && goal.targetCount > 0) {
          await tx.salesGoal.update({
            where: { id: goal.id },
            data: { isAchieved: true }
          })
        }

        salesRepName = salesRep.user.name
      }

      return { newUser, organization, salesRepName }
    })

    // Generate JWT token
    const token = generateToken(newUser.id)

    return NextResponse.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        businessType: organization.businessType,
        city: organization.city,
      },
      ...(salesRepName ? {
        salesRepId: effectiveSalesRepId,
        salesRepName: salesRepName,
      } : {})
    }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Registration error:', error)
    if (error instanceof Error && error.message === 'INVALID_SALES_REP') {
      return NextResponse.json(
        { error: 'Invalid or inactive sales representative' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
