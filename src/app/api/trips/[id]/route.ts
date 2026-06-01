import { NextRequest, NextResponse } from 'next/server'
import type { Trip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { TripStyle } from '@/types/travel'

function serializeTrip(trip: Trip) {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
    style: trip.style as TripStyle,
    summary: trip.summary,
    itinerary: trip.itinerary,
    messages: trip.messages ?? [],
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const ownerId = req.nextUrl.searchParams.get('ownerId')

    if (!ownerId) {
      return NextResponse.json({ error: 'ownerId is required.' }, { status: 400 })
    }

    const trip = await prisma.trip.findFirst({
      where: { id, ownerId },
    })

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    return NextResponse.json({ trip: serializeTrip(trip) })
  } catch (err) {
    console.error('Get trip API error:', err)
    return NextResponse.json({ error: 'Unable to load this trip.' }, { status: 500 })
  }
}
