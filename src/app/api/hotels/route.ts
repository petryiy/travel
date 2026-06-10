import { NextRequest, NextResponse } from 'next/server'
import { buildBookingComUrl, buildGoogleHotelsUrl } from '@/lib/travelLinks'
import type { HotelSuggestion } from '@/types/travel'

interface HotelRequest {
  destination: string
  checkIn: string
  checkOut: string
  guests: number
}

function redirectCards(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): HotelSuggestion[] {
  const bookingUrl = buildBookingComUrl(destination, checkIn, checkOut, guests)
  const googleHotelsUrl = buildGoogleHotelsUrl(destination, checkIn, checkOut, guests)
  const airbnbUrl = `https://www.airbnb.com/s/${encodeURIComponent(destination)}/homes?checkin=${checkIn}&checkout=${checkOut}&adults=${guests}`

  return [
    {
      id: 'search-booking',
      name: `Hotels & resorts in ${destination}`,
      stars: null,
      pricePerNight: null,
      currency: 'USD',
      neighborhood: 'Search on Booking.com',
      highlights: ['Filter by price, stars, free cancellation, and more'],
      bookingUrl,
      googleHotelsUrl,
    },
    {
      id: 'search-google',
      name: `Compare all prices in ${destination}`,
      stars: null,
      pricePerNight: null,
      currency: 'USD',
      neighborhood: 'Search on Google Hotels',
      highlights: ['Prices from Booking.com, Expedia, Hotels.com, and more'],
      bookingUrl: googleHotelsUrl,
      googleHotelsUrl,
      primaryLabel: 'Google Hotels ↗',
      secondaryLabel: 'Booking.com ↗',
    },
    {
      id: 'search-airbnb',
      name: `Apartments & local stays in ${destination}`,
      stars: null,
      pricePerNight: null,
      currency: 'USD',
      neighborhood: 'Search on Airbnb',
      highlights: ['Entire homes, private rooms, and unique experiences'],
      bookingUrl: airbnbUrl,
      googleHotelsUrl,
      primaryLabel: 'Airbnb ↗',
      secondaryLabel: 'Google Hotels ↗',
    },
  ]
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HotelRequest
  const { destination, checkIn, checkOut, guests } = body

  return NextResponse.json({
    suggestions: redirectCards(destination, checkIn, checkOut, guests),
    source: 'fallback',
  })
}
