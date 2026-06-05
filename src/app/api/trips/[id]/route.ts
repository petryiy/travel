import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import type { Itinerary, Message, TripStyle } from '@/types/travel'

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
  created_at: Date
  updated_at: Date
}

interface RenameTripBody {
  ownerId?: string
  title?: unknown
  isPublished?: unknown
}

function serializeRow(row: TripRow) {
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
  }
}

function serializeRowSummary(row: Omit<TripRow, 'itinerary' | 'messages'>) {
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
  const ownerId = session.user.id

  const client = await getClient()
  try {
    const { rows } = await client.query<TripRow>(
      'SELECT * FROM trips WHERE id = $1 AND owner_id = $2',
      [id, ownerId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    return NextResponse.json({ trip: serializeRow(rows[0]) })
  } catch (err) {
    console.error('Get trip error:', err)
    return NextResponse.json({ error: 'Unable to load this trip.' }, { status: 500 })
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
  const { ownerId, title, isPublished }: RenameTripBody = await req.json()
  const sessionOwnerId = session.user.id

  if (ownerId && ownerId !== sessionOwnerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (typeof title === 'undefined' && typeof isPublished === 'undefined') {
    return NextResponse.json({ error: 'No trip updates provided.' }, { status: 400 })
  }

  if (typeof isPublished !== 'undefined' && typeof isPublished !== 'boolean') {
    return NextResponse.json({ error: 'isPublished must be a boolean.' }, { status: 400 })
  }

  if (typeof title === 'undefined') {
    const client = await getClient()
    try {
      const now = new Date()
      const { rows } = await client.query<Omit<TripRow, 'itinerary' | 'messages'>>(
        `UPDATE trips
         SET is_published = $1, published_at = CASE WHEN $1 THEN COALESCE(published_at, $2) ELSE NULL END, updated_at = $2
         WHERE id = $3 AND owner_id = $4
         RETURNING id, owner_id, title, destination, start_date, end_date, travelers, style, summary,
                   is_published, published_at, created_at, updated_at`,
        [isPublished, now, id, sessionOwnerId]
      )

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
      }

      return NextResponse.json({ trip: serializeRowSummary(rows[0]) })
    } catch (err) {
      console.error('Publish trip error:', err)
      return NextResponse.json({ error: 'Unable to update gallery publishing.' }, { status: 500 })
    } finally {
      await client.end()
    }
  }

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId is required.' }, { status: 400 })
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

  const client = await getClient()
  try {
    const { rows } = await client.query<Omit<TripRow, 'itinerary' | 'messages'>>(
      `UPDATE trips
       SET title = $1, updated_at = $2
       WHERE id = $3 AND owner_id = $4
       RETURNING id, owner_id, title, destination, start_date, end_date, travelers, style, summary,
                 is_published, published_at, created_at, updated_at`,
      [cleanTitle, new Date(), id, sessionOwnerId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    return NextResponse.json({ trip: serializeRowSummary(rows[0]) })
  } catch (err) {
    console.error('Rename trip error:', err)
    return NextResponse.json({ error: 'Unable to rename this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
