import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
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
  created_at: Date
  updated_at: Date
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const ownerId = req.nextUrl.searchParams.get('ownerId')

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId is required.' }, { status: 400 })
  }

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
