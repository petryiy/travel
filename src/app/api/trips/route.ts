import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { createPosterCaption } from '@/lib/posterCaption'
import type { Itinerary, Message, TripStyle } from '@/types/travel'

interface SaveTripBody {
  ownerId?: string
  tripId?: string | null
  itinerary?: Itinerary
  messages?: Message[]
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
  created_at: Date
  updated_at: Date
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
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get('ownerId')
  if (!ownerId) return NextResponse.json({ trips: [] })

  const client = await getClient()
  try {
    const { rows } = await client.query<Omit<TripRow, 'itinerary' | 'messages'>>(
      `SELECT id, owner_id, title, destination, start_date, end_date, travelers, style, summary, created_at, updated_at
       FROM trips
       WHERE owner_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [ownerId]
    )
    return NextResponse.json({ trips: rows.map(serializeRowSummary) })
  } catch (err) {
    console.error('List trips error:', err)
    return NextResponse.json({ error: 'Unable to load saved trips.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

export async function POST(req: NextRequest) {
  const { ownerId, tripId, itinerary, messages = [] }: SaveTripBody = await req.json()

  if (!ownerId || !itinerary) {
    return NextResponse.json({ error: 'ownerId and itinerary are required.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const defaultTitle = titleFor(itinerary)
    const { destination, startDate, endDate, travelers, style } = itinerary.trip
    const now = new Date()

    let row: TripRow

    if (tripId) {
      const existing = await client.query<{ id: string; title: string }>(
        'SELECT id, title FROM trips WHERE id = $1 AND owner_id = $2',
        [tripId, ownerId]
      )

      if (existing.rows.length > 0) {
        const title = existing.rows[0].title || defaultTitle
        const itineraryToSave = await itineraryWithPosterCaption(itinerary, title)
        const { rows } = await client.query<TripRow>(
          `UPDATE trips
           SET title=$1, destination=$2, start_date=$3, end_date=$4, travelers=$5,
               style=$6, summary=$7, itinerary=$8::json, messages=$9::json, updated_at=$10
           WHERE id=$11
           RETURNING *`,
          [title, destination, startDate, endDate, travelers, style,
           itineraryToSave.summary, JSON.stringify(itineraryToSave), JSON.stringify(messages),
           now, existing.rows[0].id]
        )
        row = rows[0]
      } else {
        const itineraryToSave = await itineraryWithPosterCaption(itinerary, defaultTitle)
        const { rows } = await client.query<TripRow>(
          `INSERT INTO trips (id, owner_id, title, destination, start_date, end_date, travelers, style, summary, itinerary, messages, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::json, $10::json, $11, $11)
           RETURNING *`,
          [ownerId, defaultTitle, destination, startDate, endDate, travelers, style,
           itineraryToSave.summary, JSON.stringify(itineraryToSave), JSON.stringify(messages), now]
        )
        row = rows[0]
      }
    } else {
      const itineraryToSave = await itineraryWithPosterCaption(itinerary, defaultTitle)
      const { rows } = await client.query<TripRow>(
        `INSERT INTO trips (id, owner_id, title, destination, start_date, end_date, travelers, style, summary, itinerary, messages, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         RETURNING *`,
        [ownerId, defaultTitle, destination, startDate, endDate, travelers, style,
         itineraryToSave.summary, JSON.stringify(itineraryToSave), JSON.stringify(messages), now]
      )
      row = rows[0]
    }

    return NextResponse.json({ trip: serializeRow(row) })
  } catch (err) {
    console.error('Save trip error:', err)
    return NextResponse.json({ error: 'Unable to save this trip.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
