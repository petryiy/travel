import type { DayPlan, Itinerary, KeyLocation } from '@/types/travel'

function isValidCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getDayLocations(day: DayPlan): KeyLocation[] {
  return day.activities.flatMap((activity, index) => {
    const coordinates = activity.coordinates

    if (!coordinates || !isValidCoordinate(coordinates.lat) || !isValidCoordinate(coordinates.lng)) {
      return []
    }

    return {
      name: activity.location || activity.title,
      lat: coordinates.lat,
      lng: coordinates.lng,
      type: activity.type,
      day: day.day,
      order: index + 1,
      time: activity.time,
      title: activity.title,
    }
  })
}

export function getItineraryLocations(itinerary: Itinerary): KeyLocation[] {
  const activityLocations = itinerary.days.flatMap(getDayLocations)

  if (activityLocations.length > 0) {
    return activityLocations
  }

  return itinerary.keyLocations.filter((location) => (
    isValidCoordinate(location.lat) && isValidCoordinate(location.lng)
  ))
}

export function getLocationCenter(
  locations: KeyLocation[],
  fallback: { lat: number; lng: number }
) {
  const validLocations = locations.filter((location) => (
    isValidCoordinate(location.lat) && isValidCoordinate(location.lng)
  ))

  if (validLocations.length === 0) return fallback

  const totals = validLocations.reduce(
    (acc, location) => ({
      lat: acc.lat + location.lat,
      lng: acc.lng + location.lng,
    }),
    { lat: 0, lng: 0 }
  )

  return {
    lat: totals.lat / validLocations.length,
    lng: totals.lng / validLocations.length,
  }
}

export function normalizeItineraryMapData(itinerary: Itinerary): Itinerary {
  const keyLocations = getItineraryLocations(itinerary)

  return {
    ...itinerary,
    keyLocations,
    mapCenter: getLocationCenter(keyLocations, itinerary.mapCenter),
  }
}
