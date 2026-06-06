import { notFound } from 'next/navigation'
import { getClient } from '@/lib/db'
import { ItineraryOverview } from '@/components/canvas/ItineraryOverview'
import type { Itinerary, Message, TripStyle } from '@/types/travel'

export const dynamic = 'force-dynamic'

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
  author_name: string | null
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
    authorName: row.author_name,
    itinerary: row.itinerary,
    messages: row.messages ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

async function getSharedTrip(id: string) {
  const client = await getClient()
  try {
    const { rows } = await client.query<TripRow>(
      `SELECT t.*, u.name AS author_name
       FROM trips t
       LEFT JOIN users u ON u.id = t.owner_id
       WHERE t.id = $1`,
      [id]
    )

    if (rows.length === 0) return null
    return serializeRow(rows[0])
  } finally {
    await client.end()
  }
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const trip = await getSharedTrip(id)

  if (!trip) notFound()

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden">
      <ItineraryOverview
        itinerary={trip.itinerary}
        savedTripTitle={trip.title}
        savedTripId={trip.id}
        authorName={trip.authorName}
        isPublicView
      />
    </div>
  )
}
