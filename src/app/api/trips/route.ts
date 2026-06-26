import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { createPosterCaption } from '@/lib/posterCaption'
import { getTripAccess, canEdit } from '@/lib/tripAccess'
import type { CollaboratorRole, Itinerary, Message, TripStyle } from '@/types/travel'

interface SaveTripBody {
  tripId?: string | null
  itinerary?: Itinerary
  messages?: Message[]
  /** Optimistic-concurrency token; when present, a stale value is rejected (409). */
  expectedVersion?: number
}

interface TripRow {
  id: string
  owner_id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  travelers: number
  style: string
  summary: string
  itinerary: Itinerary
  messages: Message[] | null
  is_published?: boolean | null
  published_at?: Date | null
  version?: string | number | null
  updated_by?: string | null
  created_at: Date
  updated_at: Date
}

type SummaryRow = Omit<TripRow, 'itinerary' | 'messages'>

interface RowExtras {
  role?: CollaboratorRole
  ownerName?: string | null
}

function titleFor(itinerary: Itinerary) {
  const { destination, startDate, endDate } = itinerary.trip
  return `${destination} · ${startDate} to ${endDate}`
}

async function itineraryWithPosterCaption(itinerary: Itinerary, title: string) {
  return {
    ...itinerary,
    posterCaption: await createPosterCaption(itinerary, title),
  }
}

function serializeRow(row: TripRow, extras: RowExtras = {}) {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    travelers: row.travelers,
    style: row.style as TripStyle,
    summary: row.summary,
    itinerary: row.itinerary,
    messages: row.messages ?? [],
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    version: Number(row.version ?? 1),
    ...extras,
  }
}

function serializeRowSummary(row: SummaryRow, extras: RowExtras = {}) {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    travelers: row.travelers,
    style: row.style as TripStyle,
    summary: row.summary,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    version: Number(row.version ?? 1),
    ...extras,
  }
}

const SUMMARY_COLS = `id, owner_id, title, destination, start_date, end_date, travelers, style, summary,
                      is_published, published_at, version, updated_by, created_at, updated_at`

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const client = await getClient()
  try {
    const owned = await client.query<SummaryRow>(
      `SELECT ${SUMMARY_COLS} FROM trips WHERE owner_id = $1`,
      [userId]
    )

    // Trips shared *with* this user. Wrapped defensively so a missing
    // trip_collaborators table (migration not yet run) still lets owned
    // trips load. The LEFT JOIN users pattern is proven in gallery/share.
    let shared: { rows: Array<SummaryRow & { role: string; owner_name: string | null }> } = { rows: [] }
    try {
      shared = await client.query<SummaryRow & { role: string; owner_name: string | null }>(
        `SELECT t.id, t.owner_id, t.title, t.destination, t.start_date, t.end_date, t.travelers,
                t.style, t.summary, t.is_published, t.published_at, t.version, t.updated_by,
                t.created_at, t.updated_at, c.role AS role, u.name AS owner_name
         FROM trips t
         JOIN trip_collaborators c ON c.trip_id = t.id
         LEFT JOIN users u ON u.id = t.owner_id
         WHERE c.user_id = $1`,
        [userId]
      )
    } catch (err) {
      console.error('Shared trips query failed (continuing with owned only):', err)
    }

    const trips = [
      ...owned.rows.map((row) => serializeRowSummary(row, { role: 'owner' })),
      ...shared.rows.map((row) =>
        serializeRowSummary(row, { role: row.role as CollaboratorRole, ownerName: row.owner_name })
      ),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return NextResponse.json({ trips })
  } catch (err) {
    console.error('List trips error:', err)
    return NextResponse.json({ error: 'Unable to load saved trips.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { tripId, itinerary, messages = [], expectedVersion }: SaveTripBody = await req.json()

  if (!itinerary) {
    return NextResponse.json({ error: 'itinerary is required.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const defaultTitle = titleFor(itinerary)
    const { destination, startDate, endDate, travelers, style } = itinerary.trip
    const now = new Date()

    if (tripId) {
      // Updating an existing trip — owner or editor only, with version guard.
      const access = await getTripAccess(client, tripId, userId)
      if (!access) {
        return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
      }
      if (!canEdit(access.role)) {
        return NextResponse.json({ error: 'You do not have permission to edit this trip.' }, { status: 403 })
      }

      // Preserve a custom title if one was set; otherwise fall back to default.
      const titleRes = await client.query<{ title: string | null }>(
        'SELECT title FROM trips WHERE id = $1',
        [tripId]
      )
      const title = titleRes.rows[0]?.title || defaultTitle
      const itineraryToSave = await itineraryWithPosterCaption(itinerary, title)

      const guard = typeof expectedVersion === 'number' && Number.isFinite(expectedVersion)
      const params: unknown[] = [
        title, destination, startDate, endDate, travelers, style,
        itineraryToSave.summary, JSON.stringify(itineraryToSave), JSON.stringify(messages),
        userId, now, tripId,
      ]
      let sql = `UPDATE trips
                 SET title=$1, destination=$2, start_date=$3, end_date=$4, travelers=$5, style=$6,
                     summary=$7, itinerary=$8::json, messages=$9::json, updated_by=$10,
                     version = COALESCE(version, 0) + 1, updated_at=$11
                 WHERE id=$12`
      if (guard) {
        params.push(expectedVersion)
        sql += ` AND version = $13`
      }
      sql += ' RETURNING *'

      let updated
      try {
        updated = await client.query<TripRow>(sql, params)
      } catch (err) {
        // DSQL aborts one of two concurrent same-row writes with a
        // serialization failure; surface it as a version conflict to retry.
        if ((err as { code?: string }).code === '40001') {
          const cur = await client.query<{ version: string | number | null }>(
            'SELECT version FROM trips WHERE id = $1', [tripId]
          )
          return NextResponse.json(
            { error: 'version_conflict', currentVersion: Number(cur.rows[0]?.version ?? 0) },
            { status: 409 }
          )
        }
        throw err
      }

      if (updated.rows.length === 0) {
        // Guarded update matched no row: stale version, or the trip was deleted.
        const cur = await client.query<{ version: string | number | null }>(
          'SELECT version FROM trips WHERE id = $1', [tripId]
        )
        if (cur.rows.length === 0) {
          return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
        }
        return NextResponse.json(
          { error: 'version_conflict', currentVersion: Number(cur.rows[0].version ?? 0) },
          { status: 409 }
        )
      }

      return NextResponse.json({ trip: serializeRow(updated.rows[0], { role: access.role }) })
    }

    // New trip — creator becomes the owner, version starts at 1.
    const itineraryToSave = await itineraryWithPosterCaption(itinerary, defaultTitle)
    const { rows } = await client.query<TripRow>(
      `INSERT INTO trips (id, owner_id, title, destination, start_date, end_date, travelers, style,
                          summary, itinerary, messages, version, updated_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::json, $10::json, 1, $1, $11, $11)
       RETURNING *`,
      [userId, defaultTitle, destination, startDate, endDate, travelers, style,
       itineraryToSave.summary, JSON.stringify(itineraryToSave), JSON.stringify(messages), now]
    )

    return NextResponse.json({ trip: serializeRow(rows[0], { role: 'owner' }) })
  } catch (err) {
    console.error('Save trip error:', err)
    return NextResponse.json({ error: 'Unable to save this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
