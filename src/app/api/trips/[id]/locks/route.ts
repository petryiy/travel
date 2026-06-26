import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canEdit } from '@/lib/tripAccess'

const LOCK_TTL_MS = 30_000

interface AcquireBody {
  scope?: 'day' | 'ai'
  day?: number
}

function lockKeyFor(scope: 'day' | 'ai', day?: number) {
  return scope === 'ai' ? 'ai' : `day:${day}`
}

// POST — acquire a lock. Editors/owner only. 409 if someone else holds it.
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
  const userName = session.user.name ?? null
  const { scope, day }: AcquireBody = await req.json()

  if (scope !== 'day' && scope !== 'ai') {
    return NextResponse.json({ error: 'Invalid lock scope.' }, { status: 400 })
  }
  if (scope === 'day' && typeof day !== 'number') {
    return NextResponse.json({ error: 'A day is required for a day lock.' }, { status: 400 })
  }
  const lockKey = lockKeyFor(scope, day)

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (!canEdit(access.role)) {
      return NextResponse.json({ error: 'You do not have edit access.' }, { status: 403 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS)

    // Clear an expired lock or one we already hold, then take it.
    await client.query(
      'DELETE FROM trip_locks WHERE trip_id = $1 AND lock_key = $2 AND (expires_at < $3 OR user_id = $4)',
      [id, lockKey, now, userId]
    )

    try {
      await client.query(
        `INSERT INTO trip_locks (trip_id, lock_key, scope, day_number, user_id, user_name, acquired_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, lockKey, scope, scope === 'day' ? day : null, userId, userName, now, expiresAt]
      )
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === '23505' || code === '40001') {
        const held = await client.query<{ user_name: string | null; expires_at: Date }>(
          'SELECT user_name, expires_at FROM trip_locks WHERE trip_id = $1 AND lock_key = $2',
          [id, lockKey]
        )
        return NextResponse.json(
          { error: 'locked', heldBy: held.rows[0]?.user_name ?? 'Someone' },
          { status: 409 }
        )
      }
      throw err
    }

    return NextResponse.json({
      ok: true,
      lock: { scope, day: scope === 'day' ? day : null, userId, userName, expiresAt: expiresAt.toISOString() },
    })
  } catch (err) {
    console.error('Acquire lock error:', err)
    return NextResponse.json({ error: 'Unable to acquire lock.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// PATCH — heartbeat: extend the locks the client still holds. Returns the keys kept.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id
  const { keys }: { keys?: string[] } = await req.json()

  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ held: [] })
  }

  const client = await getClient()
  try {
    const expiresAt = new Date(Date.now() + LOCK_TTL_MS)
    const held: string[] = []
    for (const key of keys) {
      const { rowCount } = await client.query(
        'UPDATE trip_locks SET expires_at = $1 WHERE trip_id = $2 AND lock_key = $3 AND user_id = $4',
        [expiresAt, id, key, userId]
      )
      if (rowCount) held.push(key)
    }
    return NextResponse.json({ held })
  } catch (err) {
    console.error('Heartbeat lock error:', err)
    return NextResponse.json({ error: 'Unable to refresh locks.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// DELETE — release the given locks (or all of mine on this trip).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id

  let keys: string[] | undefined
  try {
    const body = await req.json()
    keys = Array.isArray(body?.keys) ? body.keys : undefined
  } catch {
    keys = undefined
  }

  const client = await getClient()
  try {
    if (keys && keys.length > 0) {
      for (const key of keys) {
        await client.query(
          'DELETE FROM trip_locks WHERE trip_id = $1 AND lock_key = $2 AND user_id = $3',
          [id, key, userId]
        )
      }
    } else {
      await client.query('DELETE FROM trip_locks WHERE trip_id = $1 AND user_id = $2', [id, userId])
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Release lock error:', err)
    return NextResponse.json({ error: 'Unable to release lock.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
