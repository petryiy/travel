import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, Trip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Itinerary, Message, TripStyle } from '@/types/travel'

interface SaveTripBody {
  ownerId?: string
  tripId?: string | null
  itinerary?: Itinerary
  messages?: Message[]
}

function titleFor(itinerary: Itinerary) {
  const { destination, startDate, endDate } = itinerary.trip
  return `${destination} · ${startDate} to ${endDate}`
}

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

function serializeTripSummary(trip: Pick<Trip, 'id' | 'title' | 'destination' | 'startDate' | 'endDate' | 'travelers' | 'style' | 'summary' | 'createdAt' | 'updatedAt'>) {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
    style: trip.style as TripStyle,
    summary: trip.summary,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  try {
    const ownerId = req.nextUrl.searchParams.get('ownerId')

    if (!ownerId) {
      return NextResponse.json({ trips: [] })
    }

    const trips = await prisma.trip.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        destination: true,
        startDate: true,
        endDate: true,
        travelers: true,
        style: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ trips: trips.map(serializeTripSummary) })
  } catch (err) {
    console.error('List trips API error:', err)
    return NextResponse.json({ error: 'Unable to load saved trips.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ownerId, tripId, itinerary, messages = [] }: SaveTripBody = await req.json()

    if (!ownerId || !itinerary) {
      return NextResponse.json({ error: 'ownerId and itinerary are required.' }, { status: 400 })
    }

    const data = {
      ownerId,
      title: titleFor(itinerary),
      destination: itinerary.trip.destination,
      startDate: itinerary.trip.startDate,
      endDate: itinerary.trip.endDate,
      travelers: itinerary.trip.travelers,
      style: itinerary.trip.style,
      summary: itinerary.summary,
      itinerary: itinerary as unknown as Prisma.InputJsonValue,
      messages: messages as unknown as Prisma.InputJsonValue,
    }

    const existingTrip = tripId
      ? await prisma.trip.findFirst({
          where: { id: tripId, ownerId },
          select: { id: true },
        })
      : null

    const trip = existingTrip
      ? await prisma.trip.update({ where: { id: existingTrip.id }, data })
      : await prisma.trip.create({ data })

    return NextResponse.json({ trip: serializeTrip(trip) })
  } catch (err) {
    console.error('Save trip API error:', err)
    return NextResponse.json({ error: 'Unable to save this trip.' }, { status: 500 })
  }
}
