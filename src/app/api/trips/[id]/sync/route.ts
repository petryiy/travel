import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess } from '@/lib/tripAccess'
import type { TripLock, TripPresence } from '@/types/travel'

const PRESENCE_FRESH_MS = 15_000
const PRESENCE_STALE_MS = 60_000

interface LockRow {
  scope: string
  day_number: number | null
  user_id: string
  user_name: string | null
  expires_at: Date
}

// GET — one cheap poll: version, locks, AI lock, presence, comment count.
// Also refreshes this user's presence (each poll doubles as a heartbeat).
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
  const userName = session.user.name ?? null
  const userImage = session.user.image ?? null

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const now = new Date()

    // Refresh presence (upsert without ON CONFLICT).
    const upd = await client.query(
      'UPDATE trip_presence SET user_name = $1, user_image = $2, last_seen = $3 WHERE trip_id = $4 AND user_id = $5',
      [userName, userImage, now, id, userId]
    )
    if (!upd.rowCount) {
      try {
        await client.query(
          'INSERT INTO trip_presence (trip_id, user_id, user_name, user_image, last_seen) VALUES ($1, $2, $3, $4, $5)',
          [id, userId, userName, userImage, now]
        )
      } catch {
        // raced another first-poll; the next heartbeat updates it
      }
    }

    const tripRes = await client.query<{ version: string | number | null; updated_by: string | null }>(
      'SELECT version, updated_by FROM trips WHERE id = $1',
      [id]
    )

    const locksRes = await client.query<LockRow>(
      `SELECT scope, day_number, user_id, user_name, expires_at
       FROM trip_locks WHERE trip_id = $1 AND expires_at > $2`,
      [id, now]
    )

    const presenceRes = await client.query<{ user_id: string; user_name: string | null; user_image: string | null }>(
      `SELECT user_id, user_name, user_image FROM trip_presence
       WHERE trip_id = $1 AND last_seen > $2`,
      [id, new Date(now.getTime() - PRESENCE_FRESH_MS)]
    )

    const countRes = await client.query<{ n: string | number }>(
      'SELECT COUNT(*) AS n FROM trip_comments WHERE trip_id = $1',
      [id]
    )

    // Opportunistic cleanup of long-stale presence rows.
    try {
      await client.query('DELETE FROM trip_presence WHERE trip_id = $1 AND last_seen < $2', [
        id,
        new Date(now.getTime() - PRESENCE_STALE_MS),
      ])
    } catch {
      // best-effort
    }

    const toLock = (row: LockRow): TripLock => ({
      scope: row.scope as 'day' | 'ai',
      day: row.day_number,
      userId: row.user_id,
      userName: row.user_name,
      expiresAt: row.expires_at.toISOString(),
    })

    const allLocks = locksRes.rows.map(toLock)
    const aiLock = allLocks.find((l) => l.scope === 'ai') ?? null
    const dayLocks = allLocks.filter((l) => l.scope === 'day')

    const presence: TripPresence[] = presenceRes.rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      userImage: row.user_image,
    }))

    return NextResponse.json({
      version: Number(tripRes.rows[0]?.version ?? 1),
      updatedBy: tripRes.rows[0]?.updated_by ?? null,
      role: access.role,
      locks: dayLocks,
      aiLock,
      presence,
      commentCount: Number(countRes.rows[0]?.n ?? 0),
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Unable to sync.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
