import type { Coordinates, TransportMode } from '@/types/travel'

const EARTH_RADIUS_KM = 6371

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function isValidCoordinate(point?: Coordinates | null): point is Coordinates {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180
  )
}

export function distanceKm(a: Coordinates, b: Coordinates) {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function estimateTravelMinutes(a: Coordinates, b: Coordinates, mode: TransportMode) {
  const km = distanceKm(a, b)
  const speedKph: Record<TransportMode, number> = {
    walking: 4.5,
    transit: 18,
    driving: 28,
  }
  const bufferMinutes: Record<TransportMode, number> = {
    walking: 3,
    transit: 10,
    driving: 8,
  }

  return Math.max(5, Math.round((km / speedKph[mode]) * 60 + bufferMinutes[mode]))
}

export function averageCenter(points: Coordinates[], fallback: Coordinates): Coordinates {
  const valid = points.filter(isValidCoordinate)
  if (valid.length === 0) return fallback

  const total = valid.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 }
  )

  return {
    lat: total.lat / valid.length,
    lng: total.lng / valid.length,
  }
}
