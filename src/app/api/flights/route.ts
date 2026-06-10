import { NextRequest, NextResponse } from 'next/server'
import { isTravelpayoutsConfigured, flightSearch } from '@/lib/travelpayouts'
import { cityToIata, buildSkyscannerUrl, buildGoogleFlightsUrl } from '@/lib/travelLinks'
import type { FlightOption } from '@/types/travel'

const TRIP_CLASS: Record<number, string> = { 0: 'Economy', 1: 'Business', 2: 'First' }

interface FlightRequest {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  passengers: number
  originCode?: string | null
}

function fallbackOptions(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string | null,
  passengers: number,
  originCode: string | null,
  destCode: string | null,
): FlightOption[] {
  const oCode = originCode ?? 'ANY'
  const dCode = destCode ?? 'ANY'
  const base = {
    from: origin,
    to: destination,
    departureDate,
    durationMinutes: null,
    totalPrice: null,
    currency: 'USD',
    skyscannerUrl: buildSkyscannerUrl(oCode, dCode, departureDate, returnDate, passengers),
    googleFlightsUrl: buildGoogleFlightsUrl(oCode, dCode, departureDate, returnDate, passengers),
    source: 'fallback' as const,
  }
  return [
    { ...base, id: 'fallback-1', airline: null, stops: 0 },
    { ...base, id: 'fallback-2', airline: null, stops: 1 },
  ]
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FlightRequest
    const { origin, destination, departureDate, returnDate, passengers } = body
    const originCode = body.originCode ?? cityToIata(origin)
    const destCode = cityToIata(destination)

    if (!isTravelpayoutsConfigured() || !originCode || !destCode) {
      return NextResponse.json({
        options: fallbackOptions(origin, destination, departureDate, returnDate ?? null, passengers, originCode, destCode),
        originCode,
        destinationCode: destCode,
        source: 'fallback',
      })
    }

    const offers = await flightSearch({
      origin: originCode,
      destination: destCode,
      departDate: departureDate,
      returnDate: returnDate ?? null,
      currency: 'usd',
      limit: 8,
    })

    if (offers.length === 0) {
      return NextResponse.json({
        options: fallbackOptions(origin, destination, departureDate, returnDate ?? null, passengers, originCode, destCode),
        originCode,
        destinationCode: destCode,
        source: 'fallback',
      })
    }

    const options: FlightOption[] = offers
      .filter((o) => o.actual !== false)
      .slice(0, 6)
      .map((o, i) => ({
        id: `tp-${i}`,
        airline: o.gate ?? null,
        from: o.origin,
        to: o.destination,
        departureDate: o.depart_date ?? departureDate,
        durationMinutes: o.duration && o.duration > 0 ? o.duration : null,
        stops: o.number_of_changes ?? 0,
        totalPrice: o.value ?? null,
        currency: 'USD',
        cabinClass: TRIP_CLASS[o.trip_class ?? 0] ?? 'Economy',
        skyscannerUrl: buildSkyscannerUrl(originCode, destCode, o.depart_date ?? departureDate, returnDate ?? null, passengers),
        googleFlightsUrl: buildGoogleFlightsUrl(originCode, destCode, o.depart_date ?? departureDate, returnDate ?? null, passengers),
        source: 'travelpayouts' as const,
      }))

    // Sort by price ascending
    options.sort((a, b) => {
      if (a.totalPrice === null) return 1
      if (b.totalPrice === null) return -1
      return a.totalPrice - b.totalPrice
    })

    return NextResponse.json({ options, originCode, destinationCode: destCode, source: 'travelpayouts' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Flights API error:', msg)
    return NextResponse.json({
      options: fallbackOptions('your city', 'destination', new Date().toISOString().slice(0, 10), null, 1, null, null),
      source: 'fallback',
      error: msg,
    })
  }
}
