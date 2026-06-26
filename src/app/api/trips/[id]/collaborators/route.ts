import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canManage } from '@/lib/tripAccess'
import type { Collaborator, CollaboratorRole } from '@/types/travel'

const ASSIGNABLE_ROLES: CollaboratorRole[] = ['editor', 'commenter', 'viewer']

interface InviteBody {
  email?: string
  role?: string
}

interface UserRow {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

// GET — list the owner + everyone the trip is shared with. Any participant may read.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const ownerRes = await client.query<UserRow>(
      `SELECT u.id, u.name, u.email, u.image
       FROM trips t LEFT JOIN users u ON u.id = t.owner_id
       WHERE t.id = $1`,
      [id]
    )
    const collabRes = await client.query<UserRow & { role: string }>(
      `SELECT c.user_id AS id, c.role, u.name, u.email, u.image
       FROM trip_collaborators c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.trip_id = $1
       ORDER BY c.created_at`,
      [id]
    )

    const collaborators: Collaborator[] = []
    if (ownerRes.rows[0]) {
      const o = ownerRes.rows[0]
      collaborators.push({ userId: o.id, name: o.name, email: o.email, image: o.image, role: 'owner' })
    }
    for (const row of collabRes.rows) {
      collaborators.push({
        userId: row.id,
        name: row.name,
        email: row.email,
        image: row.image,
        role: row.role as CollaboratorRole,
      })
    }

    return NextResponse.json({ collaborators, canManage: canManage(access.role) })
  } catch (err) {
    console.error('List collaborators error:', err)
    return NextResponse.json({ error: 'Unable to load collaborators.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// POST — invite a registered user by email. Owner only.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id
  const { email, role }: InviteBody = await req.json()

  const cleanEmail = (email ?? '').trim()
  if (!cleanEmail) {
    return NextResponse.json({ error: 'An email address is required.' }, { status: 400 })
  }
  if (!role || !ASSIGNABLE_ROLES.includes(role as CollaboratorRole)) {
    return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 })
  }
  const newRole = role as CollaboratorRole

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (!canManage(access.role)) {
      return NextResponse.json({ error: 'Only the owner can share this trip.' }, { status: 403 })
    }

    const userRes = await client.query<UserRow>(
      'SELECT id, name, email, image FROM users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    )
    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'no_account', message: 'No account exists for that email yet.' },
        { status: 404 }
      )
    }
    const target = userRes.rows[0]
    if (target.id === access.ownerId) {
      return NextResponse.json(
        { error: 'already_owner', message: 'That person already owns this trip.' },
        { status: 400 }
      )
    }

    // Upsert without ON CONFLICT (unsupported on DSQL).
    const now = new Date()
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM trip_collaborators WHERE trip_id = $1 AND user_id = $2',
      [id, target.id]
    )
    if (existing.rows.length > 0) {
      await client.query(
        'UPDATE trip_collaborators SET role = $1, updated_at = $2 WHERE trip_id = $3 AND user_id = $4',
        [newRole, now, id, target.id]
      )
    } else {
      try {
        await client.query(
          `INSERT INTO trip_collaborators (id, trip_id, user_id, role, invited_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [randomUUID(), id, target.id, newRole, userId, now]
        )
      } catch (err) {
        // Lost a race with a concurrent invite of the same person — just set role.
        if ((err as { code?: string }).code === '23505') {
          await client.query(
            'UPDATE trip_collaborators SET role = $1, updated_at = $2 WHERE trip_id = $3 AND user_id = $4',
            [newRole, now, id, target.id]
          )
        } else {
          throw err
        }
      }
    }

    const collaborator: Collaborator = {
      userId: target.id,
      name: target.name,
      email: target.email,
      image: target.image,
      role: newRole,
    }
    return NextResponse.json({ collaborator })
  } catch (err) {
    console.error('Invite collaborator error:', err)
    return NextResponse.json({ error: 'Unable to share this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
