import type { Client } from 'pg'

export type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

export interface TripAccess {
  role: Role
  ownerId: string
  /** Current optimistic-concurrency version of the trip row. */
  version: number
}

/**
 * Resolve a user's access to a trip in one place. Reuses the caller's open
 * pg.Client (no extra connection). Returns null when the trip does not exist
 * or the user is neither owner nor a collaborator.
 *
 * version is BIGINT in DSQL and comes back from pg as a string, so it is
 * coerced to a number here.
 */
export async function getTripAccess(
  client: Client,
  tripId: string,
  userId: string
): Promise<TripAccess | null> {
  const tripRes = await client.query<{ owner_id: string; version: string | number | null }>(
    'SELECT owner_id, version FROM trips WHERE id = $1',
    [tripId]
  )
  if (tripRes.rows.length === 0) return null

  const ownerId = tripRes.rows[0].owner_id
  const version = Number(tripRes.rows[0].version ?? 1)

  if (ownerId === userId) {
    return { role: 'owner', ownerId, version }
  }

  const collabRes = await client.query<{ role: string }>(
    'SELECT role FROM trip_collaborators WHERE trip_id = $1 AND user_id = $2',
    [tripId, userId]
  )
  if (collabRes.rows.length === 0) return null

  return { role: collabRes.rows[0].role as Role, ownerId, version }
}

export const canComment = (role: Role) => role !== 'viewer'
export const canEdit = (role: Role) => role === 'owner' || role === 'editor'
export const canManage = (role: Role) => role === 'owner'
