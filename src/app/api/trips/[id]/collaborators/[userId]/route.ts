import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canManage } from '@/lib/tripAccess'
import type { CollaboratorRole } from '@/types/travel'

const ASSIGNABLE_ROLES: CollaboratorRole[] = ['editor', 'commenter', 'viewer']

// PATCH — change a collaborator's role. Owner only.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, userId } = await context.params
  const sessionUserId = session.user.id
  const { role }: { role?: string } = await req.json()

  if (!role || !ASSIGNABLE_ROLES.includes(role as CollaboratorRole)) {
    return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, sessionUserId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (!canManage(access.role)) {
      return NextResponse.json({ error: 'Only the owner can change roles.' }, { status: 403 })
    }
    if (userId === access.ownerId) {
      return NextResponse.json({ error: "The owner's role cannot be changed." }, { status: 400 })
    }

    const { rowCount } = await client.query(
      'UPDATE trip_collaborators SET role = $1, updated_at = $2 WHERE trip_id = $3 AND user_id = $4',
      [role, new Date(), id, userId]
    )
    if (!rowCount) {
      return NextResponse.json({ error: 'Collaborator not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, userId, role })
  } catch (err) {
    console.error('Update collaborator role error:', err)
    return NextResponse.json({ error: 'Unable to update this collaborator.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// DELETE — owner removes anyone; a collaborator may remove themselves (leave).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, userId } = await context.params
  const sessionUserId = session.user.id

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, sessionUserId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const isOwner = canManage(access.role)
    const isSelf = userId === sessionUserId
    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }
    if (userId === access.ownerId) {
      return NextResponse.json({ error: 'The owner cannot be removed.' }, { status: 400 })
    }

    const { rowCount } = await client.query(
      'DELETE FROM trip_collaborators WHERE trip_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (!rowCount) {
      return NextResponse.json({ error: 'Collaborator not found.' }, { status: 404 })
    }

    // Best-effort: drop any locks/presence the removed user held on this trip.
    for (const table of ['trip_locks', 'trip_presence']) {
      try {
        await client.query(`DELETE FROM ${table} WHERE trip_id = $1 AND user_id = $2`, [id, userId])
      } catch {
        // tables may not exist before the M3 migration; ignore
      }
    }

    return NextResponse.json({ ok: true, id, userId })
  } catch (err) {
    console.error('Remove collaborator error:', err)
    return NextResponse.json({ error: 'Unable to remove this collaborator.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
