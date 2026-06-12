import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hashPassword } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/users/[id] - Get a single user's full details (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    const targetUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        supabaseUid: true,
        memberships: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                businessType: true,
                city: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
              }
            }
          }
        },
        shopMemberships: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            shop: {
              select: {
                id: true,
                name: true,
                city: true,
                isActive: true,
                organization: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        salesRep: {
          select: {
            id: true,
            phone: true,
            targetCity: true,
            commissionRate: true,
            commissionPerReg: true,
            isActive: true,
          }
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        ...targetUser,
        createdAt: targetUser.createdAt.toISOString(),
        updatedAt: targetUser.updatedAt.toISOString(),
        memberships: targetUser.memberships.map(m => ({
          ...m,
          joinedAt: m.joinedAt.toISOString(),
        })),
        shopMemberships: targetUser.shopMemberships.map(m => ({
          ...m,
          joinedAt: m.joinedAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id] - Update a user (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { name, role, password } = body

    // Verify user exists
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admin from demoting themselves
    if (existing.id === user.id && role && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    // Prevent the last admin from being demoted
    if (existing.role === 'admin' && role && role !== 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (password) updateData.passwordHash = await hashPassword(password)

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: { id: true, name: true, businessType: true }
            }
          }
        }
      },
    })

    return NextResponse.json({
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        organizations: updated.memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          businessType: m.organization.businessType,
        })),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] - Delete a user and all their data (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    // Verify user exists
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admin from deleting themselves
    if (existing.id === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Prevent deleting the last admin
    if (existing.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 })
      }
    }

    // Delete the user — cascading will handle memberships, sessions, shopMemberships
    // But organizations owned by this user need to be handled:
    // If the user is the only owner of an org, delete the org too
    const ownedOrgs = await db.organizationMember.findMany({
      where: { userId: id, role: 'owner' },
      include: {
        organization: {
          include: {
            members: { where: { role: 'owner' } }
          }
        }
      }
    })

    // Find orgs where this user is the sole owner
    const soleOwnedOrgIds = ownedOrgs
      .filter(m => m.organization.members.length <= 1)
      .map(m => m.organizationId)

    // Delete sole-owned organizations (cascading handles their data)
    if (soleOwnedOrgIds.length > 0) {
      await db.organization.deleteMany({
        where: { id: { in: soleOwnedOrgIds } }
      })
    }

    // Delete the user
    await db.user.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      deletedOrgIds: soleOwnedOrgIds,
      message: `User deleted successfully${soleOwnedOrgIds.length > 0 ? `. ${soleOwnedOrgIds.length} organization(s) with no remaining owner were also deleted.` : ''}`,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
