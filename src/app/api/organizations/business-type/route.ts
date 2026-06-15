import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { seedBusinessTemplateStandalone } from '@/lib/seed-business-template'
import { VALID_BUSINESS_TYPES, mapLegacyBusinessType } from '@/lib/business-templates'

// POST /api/organizations/business-type - Update business type and seed templates
export async function POST(request: Request) {
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

    const { orgId, businessType } = body

    if (!orgId || !businessType) {
      return NextResponse.json({ error: 'orgId and businessType are required' }, { status: 400 })
    }

    // Validate business type
    const allValidTypes = [...VALID_BUSINESS_TYPES, 'retail', 'service', 'mixed']
    if (!allValidTypes.includes(businessType)) {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 })
    }

    // Only owners/managers can update business type
    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
    })

    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Only owners or managers can change business type' }, { status: 403 })
    }

    // Update business type
    await db.organization.update({
      where: { id: orgId },
      data: { businessType },
    })

    // Seed templates if the org has no product types yet
    const seedResult = await seedBusinessTemplateStandalone(orgId, businessType)

    return NextResponse.json({
      success: true,
      businessType,
      seeded: seedResult.productTypeCount > 0,
      productTypeCount: seedResult.productTypeCount,
      attributeCount: seedResult.attributeCount,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update business type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
