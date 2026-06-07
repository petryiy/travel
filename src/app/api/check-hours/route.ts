import { NextRequest, NextResponse } from 'next/server'

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

// OSM day ordering: Mo=0 … Su=6
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function jsDayToOsm(jsDay: number): number {
  // JS: 0=Sun → OSM Su=6; JS 1=Mon → OSM Mo=0
  return jsDay === 0 ? 6 : jsDay - 1
}

function osmDayIdx(abbr: string): number {
  return OSM_DAYS.indexOf(abbr.trim())
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function dayInOsmSpec(osmDay: number, spec: string): boolean {
  for (const part of spec.split(',').map((s) => s.trim())) {
    if (part.includes('-')) {
      const [fromStr, toStr] = part.split('-')
      const from = osmDayIdx(fromStr.trim())
      const to = osmDayIdx(toStr.trim())
      if (from <= to ? osmDay >= from && osmDay <= to : osmDay >= from || osmDay <= to) return true
    } else if (osmDayIdx(part) === osmDay) {
      return true
    }
  }
  return false
}

function parseOsmHours(
  ohStr: string,
  osmDay: number,
  startMin: number,
): { isOpen: boolean; window: string } | null {
  const s = ohStr.trim()
  if (s === '24/7') return { isOpen: true, window: '24/7' }
  if (s === 'off') return { isOpen: false, window: 'Closed' }

  for (const rule of s.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z, -]+?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/)
    if (!m) continue
    const daySpec = m[1].trim()
    const openMin = timeToMinutes(m[2])
    const closeMin = timeToMinutes(m[3])
    if (dayInOsmSpec(osmDay, daySpec)) {
      return {
        isOpen: startMin >= openMin && startMin < closeMin,
        window: `${m[2]}–${m[3]}`,
      }
    }
  }
  return null
}

// ── Google Places ─────────────────────────────────────────────────────────────

async function checkGoogle(
  name: string,
  lat: number,
  lng: number,
  jsDay: number,
  startMin: number,
): Promise<{ isOpen: boolean; window: string | null; hoursNote: string | null } | null> {
  if (!PLACES_KEY) return null

  // Step 1: Text search to resolve place_id
  const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  searchUrl.searchParams.set('query', name)
  searchUrl.searchParams.set('location', `${lat},${lng}`)
  searchUrl.searchParams.set('radius', '200')
  searchUrl.searchParams.set('key', PLACES_KEY)

  const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(5000) })
  const searchData = await searchRes.json() as {
    status: string
    results: Array<{ place_id: string }>
  }

  if (searchData.status !== 'OK' || !searchData.results[0]) return null
  const placeId = searchData.results[0].place_id

  // Step 2: Place Details for opening_hours
  const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  detailUrl.searchParams.set('place_id', placeId)
  detailUrl.searchParams.set('fields', 'opening_hours')
  detailUrl.searchParams.set('key', PLACES_KEY)

  const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(5000) })
  const detailData = await detailRes.json() as {
    status: string
    result: {
      opening_hours?: {
        periods?: Array<{
          open: { day: number; time: string }
          close?: { day: number; time: string }
        }>
        weekday_text?: string[]
      }
    }
  }

  if (detailData.status !== 'OK' || !detailData.result.opening_hours) return null

  const { periods, weekday_text } = detailData.result.opening_hours

  // weekday_text[0]=Monday … [6]=Sunday; jsDay 0=Sun 1=Mon … 6=Sat
  const noteIdx = jsDay === 0 ? 6 : jsDay - 1
  const hoursNote = weekday_text?.[noteIdx]?.replace(/^[^:]+:\s*/, '') ?? null

  if (!periods) return { isOpen: null as unknown as boolean, window: null, hoursNote }

  // Find the period for this day
  const period = periods.find((p) => p.open.day === jsDay)
  if (!period) {
    return { isOpen: false, window: 'Closed', hoursNote }
  }

  const openMin = timeToMinutes(`${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}`)
  const closeMin = period.close
    ? timeToMinutes(`${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`)
    : 24 * 60

  const window = period.close
    ? `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}–${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`
    : 'Open'

  return { isOpen: startMin >= openMin && startMin < closeMin, window, hoursNote }
}

// ── OSM Overpass ──────────────────────────────────────────────────────────────

async function checkOsm(
  lat: number,
  lng: number,
  osmDay: number,
  startMin: number,
): Promise<{ isOpen: boolean; window: string | null; hoursNote: string | null } | null> {
  const query = `[out:json][timeout:6];(node(around:100,${lat},${lng})["opening_hours"];way(around:100,${lat},${lng})["opening_hours"];);out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(8000),
  })

  const data = await res.json() as { elements?: Array<{ tags?: { opening_hours?: string } }> }
  const ohStr = data.elements?.find((el) => el.tags?.opening_hours)?.tags?.opening_hours
  if (!ohStr) return null

  const parsed = parseOsmHours(ohStr, osmDay, startMin)
  if (!parsed) return null

  return { isOpen: parsed.isOpen, window: parsed.window, hoursNote: ohStr }
}

// ── Main handler ──────────────────────────────────────────────────────────────

interface ActivityToCheck {
  dayIdx: number
  actIdx: number
  locationName: string
  lat: number
  lng: number
  date: string      // YYYY-MM-DD
  startTime: string // HH:MM
}

interface HoursResult {
  dayIdx: number
  actIdx: number
  source: 'google' | 'osm' | 'none'
  isOpen: boolean | null
  openWindow: string | null
  hoursNote: string | null
  hoursWarning: string | null
}

async function checkActivity(act: ActivityToCheck): Promise<HoursResult> {
  const base = { dayIdx: act.dayIdx, actIdx: act.actIdx }
  const [y, mo, d] = act.date.split('-').map(Number)
  const jsDay = new Date(y, mo - 1, d).getDay()
  const osmDay = jsDayToOsm(jsDay)
  const startMin = timeToMinutes(act.startTime)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  function buildWarning(isOpen: boolean, window: string | null): string | null {
    if (isOpen) return null
    if (window === 'Closed') return `Closed on ${dayNames[jsDay]}s`
    if (window) return `Scheduled at ${act.startTime} but open ${window}`
    return `May be closed at ${act.startTime}`
  }

  // Tier 2: Google Places
  try {
    const google = await checkGoogle(act.locationName, act.lat, act.lng, jsDay, startMin)
    if (google) {
      return {
        ...base,
        source: 'google',
        isOpen: google.isOpen,
        openWindow: google.window,
        hoursNote: google.hoursNote,
        hoursWarning: buildWarning(google.isOpen, google.window),
      }
    }
  } catch {
    // fall through to OSM
  }

  // Tier 3: OSM Overpass
  try {
    const osm = await checkOsm(act.lat, act.lng, osmDay, startMin)
    if (osm) {
      return {
        ...base,
        source: 'osm',
        isOpen: osm.isOpen,
        openWindow: osm.window,
        hoursNote: osm.hoursNote,
        hoursWarning: buildWarning(osm.isOpen, osm.window),
      }
    }
  } catch {
    // ignore
  }

  return { ...base, source: 'none', isOpen: null, openWindow: null, hoursNote: null, hoursWarning: null }
}

export async function POST(req: NextRequest) {
  try {
    const { activities } = await req.json() as { activities: ActivityToCheck[] }
    const results = await Promise.all(activities.map(checkActivity))
    return NextResponse.json({ results })
  } catch (err) {
    console.error('check-hours error:', err)
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
