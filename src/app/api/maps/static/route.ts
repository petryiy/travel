import { NextRequest, NextResponse } from 'next/server'

interface StaticMapPoint {
  lat: number
  lng: number
}

interface StaticMapGroup {
  color: string
  points: StaticMapPoint[]
}

interface StaticMapPayload {
  center: StaticMapPoint
  width: number
  height: number
  paths: StaticMapGroup[]
  markers: StaticMapGroup[]
}

function decodePayload(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as StaticMapPayload
}

function isPoint(value: StaticMapPoint) {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng)
}

function cleanColor(value: string) {
  return value.replace(/[^a-fA-F0-9]/g, '').slice(0, 6) || '456b72'
}

function pointParam(point: StaticMapPoint) {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

function validGroup(group: StaticMapGroup) {
  return {
    color: cleanColor(group.color),
    points: group.points.filter(isPoint).slice(0, 30),
  }
}

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_MAPS_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const payloadParam = req.nextUrl.searchParams.get('payload')

  if (!key || !payloadParam) {
    return NextResponse.json({ error: 'Google Maps key and payload are required.' }, { status: 400 })
  }

  try {
    const payload = decodePayload(payloadParam)
    const width = Math.min(Math.max(Math.round(payload.width || 936), 320), 1000)
    const height = Math.min(Math.max(Math.round(payload.height || 378), 220), 1000)
    const center = isPoint(payload.center) ? payload.center : { lat: 0, lng: 0 }
    const params = new URLSearchParams({
      key,
      size: `${width}x${height}`,
      scale: '2',
      maptype: 'roadmap',
      center: pointParam(center),
      zoom: '11',
    })

    params.append('style', 'feature:poi.business|visibility:off')
    params.append('style', 'feature:transit.station|visibility:simplified')
    params.append('style', 'feature:road|element:labels|visibility:simplified')
    params.append('style', 'feature:landscape|color:0xf1ead8')
    params.append('style', 'feature:water|color:0xd5e8ef')

    const pathGroups = payload.paths.map(validGroup)
    const markerGroups = payload.markers.map(validGroup)
    const allPoints = markerGroups.flatMap((group) => group.points)

    pathGroups.forEach((group) => {
      if (group.points.length < 2) return
      params.append(
        'path',
        [`color:0x${group.color}dd`, 'weight:5', ...group.points.map(pointParam)].join('|')
      )
    })

    markerGroups.forEach((group) => {
      if (group.points.length === 0) return
      params.append(
        'markers',
        [`size:small`, `color:0x${group.color}`, ...group.points.map(pointParam)].join('|')
      )
    })

    if (allPoints.length > 0) {
      params.append('visible', allPoints.map(pointParam).join('|'))
    }

    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: 'Unable to load Google map.' }, { status: 502 })
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Static map error:', err)
    return NextResponse.json({ error: 'Invalid static map payload.' }, { status: 400 })
  }
}
