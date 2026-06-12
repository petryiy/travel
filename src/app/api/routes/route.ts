import { NextRequest, NextResponse } from 'next/server'
import type { TravelMode, TravelOption } from '@/types/travel'

const DIRECTIONS_KEY =
  process.env.GOOGLE_DIRECTIONS_API_KEY ??
  process.env.GOOGLE_MAPS_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

const MAX_SEGMENTS_PER_REQUEST = 30

type GoogleMode = 'walking' | 'transit' | 'driving'

interface RoutePoint {
  lat: number
  lng: number
  name?: string
}

interface RouteSegment {
  dayIdx: number
  actIdx: number
  date: string
  departureTime?: string
  origin: RoutePoint
  destination: RoutePoint
}

interface DirectionsValue {
  text?: string
  value?: number
}

interface DirectionsTransitStep {
  departure_stop?: { name?: string }
  arrival_stop?: { name?: string }
  line?: {
    name?: string
    short_name?: string
    vehicle?: { type?: string; name?: string }
  }
  num_stops?: number
}

interface DirectionsStep {
  travel_mode?: string
  html_instructions?: string
  duration?: DirectionsValue
  transit_details?: DirectionsTransitStep
}

interface DirectionsLeg {
  distance?: DirectionsValue
  duration?: DirectionsValue
  duration_in_traffic?: DirectionsValue
  steps?: DirectionsStep[]
}

interface DirectionsRoute {
  summary?: string
  fare?: { text?: string }
  legs?: DirectionsLeg[]
}

interface DirectionsResponse {
  status: string
  error_message?: string
  routes?: DirectionsRoute[]
}

function isFinitePoint(point: RoutePoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
}

function stripHtml(value?: string) {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function departureTimestamp(date: string, time?: string) {
  const planned = new Date(`${date}T${time || '09:00'}:00`)
  if (Number.isNaN(planned.getTime())) return 'now'

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
  if (planned.getTime() <= fiveMinutesFromNow) return 'now'
  return String(Math.floor(planned.getTime() / 1000))
}

function modeFromTransitSteps(steps: DirectionsStep[]): TravelMode {
  const types = new Set(
    steps
      .filter((step) => step.travel_mode === 'TRANSIT')
      .map((step) => step.transit_details?.line?.vehicle?.type)
      .filter(Boolean)
  )

  if (types.size !== 1) return 'transit'
  const [type] = Array.from(types)
  if (type === 'BUS') return 'bus'
  if (type === 'FERRY') return 'ferry'
  if (['RAIL', 'HEAVY_RAIL', 'COMMUTER_TRAIN', 'HIGH_SPEED_TRAIN', 'METRO_RAIL', 'SUBWAY', 'TRAM', 'MONORAIL'].includes(type ?? '')) {
    return 'train'
  }
  return 'transit'
}

function transitLineName(step: DirectionsStep) {
  return step.transit_details?.line?.short_name ?? step.transit_details?.line?.name ?? 'Transit'
}

function describeTransit(steps: DirectionsStep[]) {
  const transitSteps = steps.filter((step) => step.travel_mode === 'TRANSIT' && step.transit_details)
  const walkingMinutes = steps
    .filter((step) => step.travel_mode === 'WALKING')
    .reduce((total, step) => total + Math.round((step.duration?.value ?? 0) / 60), 0)

  const transitParts = transitSteps.slice(0, 3).map((step) => {
    const details = step.transit_details
    const line = transitLineName(step)
    const from = details?.departure_stop?.name
    const to = details?.arrival_stop?.name
    const stops = details?.num_stops ? ` (${details.num_stops} stops)` : ''
    if (from && to) return `Take ${line} from ${from} to ${to}${stops}`
    return stripHtml(step.html_instructions) || `Take ${line}${stops}`
  })

  if (walkingMinutes > 0) transitParts.push(`${walkingMinutes} min walking`)
  return transitParts.join(', then ')
}

function routeToOption(route: DirectionsRoute, requestedMode: GoogleMode): TravelOption | null {
  const leg = route.legs?.[0]
  if (!leg) return null

  const durationSeconds = requestedMode === 'driving'
    ? leg.duration_in_traffic?.value ?? leg.duration?.value
    : leg.duration?.value
  if (!durationSeconds) return null

  const steps = leg.steps ?? []
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60))

  if (requestedMode === 'transit') {
    const routeName = steps
      .filter((step) => step.travel_mode === 'TRANSIT')
      .map(transitLineName)
      .filter(Boolean)
      .join(' + ')

    return {
      mode: modeFromTransitSteps(steps),
      durationMinutes,
      routeName: routeName || 'Public transport',
      cost: route.fare?.text,
      description: describeTransit(steps) || `Public transport route, ${leg.distance?.text ?? ''}`.trim(),
      source: 'google',
    }
  }

  if (requestedMode === 'walking') {
    return {
      mode: 'walk',
      durationMinutes,
      routeName: 'Walk',
      description: `Walk ${leg.distance?.text ? `${leg.distance.text}` : 'to the next stop'}${route.summary ? ` via ${route.summary}` : ''}`,
      source: 'google',
    }
  }

  return {
    mode: 'taxi',
    durationMinutes,
    routeName: route.summary || 'Taxi / rideshare',
    description: `Taxi or rideshare${route.summary ? ` via ${route.summary}` : ''}${leg.distance?.text ? ` (${leg.distance.text})` : ''}`,
    source: 'google',
  }
}

async function fetchDirections(segment: RouteSegment, mode: GoogleMode): Promise<TravelOption[]> {
  if (!DIRECTIONS_KEY) return []

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${segment.origin.lat},${segment.origin.lng}`)
  url.searchParams.set('destination', `${segment.destination.lat},${segment.destination.lng}`)
  url.searchParams.set('mode', mode)
  url.searchParams.set('alternatives', 'true')
  url.searchParams.set('departure_time', departureTimestamp(segment.date, segment.departureTime))
  url.searchParams.set('key', DIRECTIONS_KEY)
  if (mode === 'driving') url.searchParams.set('traffic_model', 'best_guess')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []

  const data = await res.json() as DirectionsResponse
  if (data.status !== 'OK') return []

  return (data.routes ?? [])
    .slice(0, mode === 'transit' ? 3 : 1)
    .map((route) => routeToOption(route, mode))
    .filter((option): option is TravelOption => Boolean(option))
}

function routeScore(option: TravelOption) {
  let score = option.durationMinutes
  if (option.mode === 'taxi' || option.mode === 'rideshare') score += 8
  if (option.mode === 'walk' && option.durationMinutes > 25) score += 25
  if (['transit', 'bus', 'train', 'ferry'].includes(option.mode)) score -= 3
  return score
}

function dedupeOptions(options: TravelOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.mode}:${option.routeName ?? ''}:${Math.round(option.durationMinutes / 3)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function enrichSegment(segment: RouteSegment) {
  if (!isFinitePoint(segment.origin) || !isFinitePoint(segment.destination)) {
    return { dayIdx: segment.dayIdx, actIdx: segment.actIdx, options: [] }
  }

  const [transit, walking, driving] = await Promise.all([
    fetchDirections(segment, 'transit'),
    fetchDirections(segment, 'walking'),
    fetchDirections(segment, 'driving'),
  ])

  const options = dedupeOptions([...transit, ...walking, ...driving])
    .sort((a, b) => routeScore(a) - routeScore(b))
    .slice(0, 3)
    .map((option, index) => ({ ...option, recommended: index === 0 }))

  return {
    dayIdx: segment.dayIdx,
    actIdx: segment.actIdx,
    origin: segment.origin,
    destination: segment.destination,
    options,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { segments } = await req.json() as { segments?: RouteSegment[] }
    if (!DIRECTIONS_KEY) {
      return NextResponse.json({ results: [], error: 'Google Directions key is not configured.' }, { status: 200 })
    }

    const safeSegments = (segments ?? [])
      .filter((segment) => segment && segment.origin && segment.destination)
      .slice(0, MAX_SEGMENTS_PER_REQUEST)

    const results = await Promise.all(safeSegments.map(enrichSegment))
    return NextResponse.json({ results })
  } catch (err) {
    console.error('routes enrichment error:', err)
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
