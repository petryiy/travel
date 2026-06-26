import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canEdit, canManage } from '@/lib/tripAccess'
import type { CollaboratorRole, Itinerary, Message, TripStyle } from '@/types/travel'

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

interface RenameTripBody {
  ownerId?: string
  title?: unknown
  isPublished?: unknown
}

const SUMMARY_COLS = `id, owner_id, title, destination, start_date, end_date, travelers, style, summary,
                      is_published, published_at, version, updated_by, created_at, updated_at`

function serializeRow(row: TripRow, role: CollaboratorRole) {
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
    role,
  }
}

function serializeRowSummary(row: SummaryRow, role: CollaboratorRole) {
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
    role,
  }
}

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

    const { rows } = await client.query<TripRow>('SELECT * FROM trips WHERE id = $1', [id])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    return NextResponse.json({ trip: serializeRow(rows[0], access.role) })
  } catch (err) {
    console.error('Get trip error:', err)
    return NextResponse.json({ error: 'Unable to load this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

export async function DELETE(
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
    if (access.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can delete this trip.' }, { status: 403 })
    }

    // DSQL has no cascading deletes (no REFERENCES); remove dependent rows.
    for (const table of ['trip_collaborators', 'trip_comments', 'trip_locks', 'trip_presence']) {
      try {
        await client.query(`DELETE FROM ${table} WHERE trip_id = $1`, [id])
      } catch (err) {
        console.error(`Cleanup of ${table} failed during trip delete:`, err)
      }
    }

    await client.query('DELETE FROM trips WHERE id = $1', [id])
    return NextResponse.json({ id })
  } catch (err) {
    console.error('Delete trip error:', err)
    return NextResponse.json({ error: 'Unable to delete this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

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
  const { title, isPublished }: RenameTripBody = await req.json()

  if (typeof title === 'undefined' && typeof isPublished === 'undefined') {
    return NextResponse.json({ error: 'No trip updates provided.' }, { status: 400 })
  }
  if (typeof isPublished !== 'undefined' && typeof isPublished !== 'boolean') {
    return NextResponse.json({ error: 'isPublished must be a boolean.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    // Publish toggle — owner only.
    if (typeof title === 'undefined') {
      if (!canManage(access.role)) {
        return NextResponse.json({ error: 'Only the owner can publish this trip.' }, { status: 403 })
      }
      const now = new Date()
      const { rows } = await client.query<SummaryRow>(
        `UPDATE trips
         SET is_published = $1, published_at = CASE WHEN $1 THEN COALESCE(published_at, $2) ELSE NULL END, updated_at = $2
         WHERE id = $3
         RETURNING ${SUMMARY_COLS}`,
        [isPublished, now, id]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
      }
      return NextResponse.json({ trip: serializeRowSummary(rows[0], access.role) })
    }

    // Rename — owner or editor.
    if (!canEdit(access.role)) {
      return NextResponse.json({ error: 'You do not have permission to rename this trip.' }, { status: 403 })
    }
    if (typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 })
    }
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      return NextResponse.json({ error: 'title cannot be empty.' }, { status: 400 })
    }
    if (cleanTitle.length > 120) {
      return NextResponse.json({ error: 'title is too long.' }, { status: 400 })
    }

    const { rows } = await client.query<SummaryRow>(
      `UPDATE trips
       SET title = $1, updated_at = $2
       WHERE id = $3
       RETURNING ${SUMMARY_COLS}`,
      [cleanTitle, new Date(), id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    return NextResponse.json({ trip: serializeRowSummary(rows[0], access.role) })
  } catch (err) {
    console.error('Update trip error:', err)
    return NextResponse.json({ error: 'Unable to update this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
