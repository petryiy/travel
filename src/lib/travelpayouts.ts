const FLIGHTS_BASE = 'https://api.travelpayouts.com'
const HOTELS_BASE = 'https://engine.hotellook.com'

export function isTravelpayoutsConfigured(): boolean {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN)
}

function token(): string {
  return process.env.TRAVELPAYOUTS_TOKEN!
}

// ── Flights ───────────────────────────────────────────────────────────────────

export interface TpFlightOffer {
  origin: string
  destination: string
  depart_date: string
  return_date: string | null
  value: number          // price in requested currency
  number_of_changes: number
  trip_class: number     // 0=economy 1=business 2=first
  actual: boolean
  duration?: number      // total trip duration in minutes (month-matrix)
  gate?: string          // booking site / airline (month-matrix)
}

export async function flightSearch(params: {
  origin: string       // IATA code
  destination: string  // IATA code
  departDate: string   // YYYY-MM-DD — month is extracted for the month-matrix query
  returnDate?: string | null
  currency?: string
  limit?: number
}): Promise<TpFlightOffer[]> {
  // Use month-matrix which returns real prices for a given month; /latest returns empty
  const month = params.departDate.slice(0, 7) // "YYYY-MM"
  const p: Record<string, string> = {
    currency: params.currency ?? 'usd',
    origin: params.origin,
    destination: params.destination,
    month,
    token: token(),
  }

  const url = `${FLIGHTS_BASE}/v2/prices/month-matrix?${new URLSearchParams(p)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Travelpayouts flights error: ${res.status}`)

  const data = await res.json() as { success?: boolean; data?: TpFlightOffer[] }
  if (!data.success || !Array.isArray(data.data)) return []
  return data.data.slice(0, params.limit ?? 10)
}

// ── Hotels ────────────────────────────────────────────────────────────────────

export interface TpHotel {
  id: number | string
  // Hotellook returns various name field shapes depending on endpoint
  name?: string
  fullName?: string
  hotelName?: string
  stars: number | string | null
  priceFrom?: number | null
  priceAvg?: number | null
  priceTo?: number | null
  price?: number | null        // some endpoints use a flat price field
  location?: {
    name?: string
    country?: string
    geo?: { lat?: number; lon?: number }
  }
  photoUrl?: string
  url?: string
}

export function hotelName(h: TpHotel): string {
  return h.name ?? h.fullName ?? h.hotelName ?? `Hotel ${h.id}`
}

export function hotelPrice(h: TpHotel): number | null {
  const v = h.priceFrom ?? h.priceAvg ?? h.price ?? null
  return v !== null && v !== undefined ? Number(v) : null
}

export async function hotelSearch(params: {
  location: string   // city name or IATA code
  checkIn: string    // YYYY-MM-DD
  checkOut: string   // YYYY-MM-DD
  adults: number
  limit?: number
  currency?: string
}): Promise<TpHotel[]> {
  const p: Record<string, string> = {
    location: params.location,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: String(params.adults),
    token: token(),
    limit: String(params.limit ?? 10),
    currency: params.currency ?? 'usd',
    lang: 'en',
  }

  const url = `${HOTELS_BASE}/api/v2/cache.json?${new URLSearchParams(p)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hotellook error: ${res.status}`)

  const data = await res.json()
  // Response is either a direct array or wrapped in a results/hotels key
  if (Array.isArray(data)) return data as TpHotel[]
  if (Array.isArray(data?.results)) return data.results as TpHotel[]
  if (Array.isArray(data?.hotels)) return data.hotels as TpHotel[]
  if (Array.isArray(data?.results?.hotels)) return data.results.hotels as TpHotel[]
  return []
}
