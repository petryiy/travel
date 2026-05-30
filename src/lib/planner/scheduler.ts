import type {
  Activity,
  ActivityCategory,
  ActivityPeriod,
  DayFeasibility,
  DayPlan,
  Itinerary,
  RouteStop,
  TripDetails,
} from '@/types/travel'
import { averageCenter, estimateTravelMinutes, isValidCoordinate } from './geo'

const PERIOD_ORDER: ActivityPeriod[] = ['morning', 'midday', 'afternoon', 'evening']
const DAY_START_MINUTES = 9 * 60
const DAY_END_MINUTES = 21 * 60

const DEFAULT_DURATIONS: Record<ActivityCategory, number> = {
  food: 70,
  attraction: 95,
  transport: 35,
  accommodation: 45,
  activity: 100,
  shopping: 75,
  nightlife: 90,
}

function minutesToClock(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60) % 24
  const mins = safeMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

function stableId(day: number, index: number, title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  return `day-${day}-${index + 1}-${slug || 'stop'}`
}

function durationFor(activity: Activity, trip: TripDetails) {
  const base = activity.durationMinutes ?? DEFAULT_DURATIONS[activity.category] ?? 75
  const paceMultiplier = {
    easy: 1.15,
    balanced: 1,
    packed: 0.82,
  }[trip.pace]

  return Math.max(25, Math.round(base * paceMultiplier))
}

function rankNextStop(current: Activity, candidate: Activity, trip: TripDetails) {
  if (!isValidCoordinate(current.coordinates) || !isValidCoordinate(candidate.coordinates)) {
    return 9999
  }

  const travel = estimateTravelMinutes(current.coordinates, candidate.coordinates, trip.transport)
  const priorityBoost = (candidate.priority ?? 3) * 4
  const sameCategoryPenalty = current.category === candidate.category ? 8 : 0
  return travel + sameCategoryPenalty - priorityBoost
}

function orderWithinPeriod(activities: Activity[], trip: TripDetails) {
  const remaining = [...activities]
  const ordered: Activity[] = []

  while (remaining.length > 0) {
    if (ordered.length === 0) {
      const next = remaining
        .map((activity, index) => ({ activity, index }))
        .sort((a, b) => (b.activity.priority ?? 3) - (a.activity.priority ?? 3))[0]
      ordered.push(next.activity)
      remaining.splice(next.index, 1)
      continue
    }

    const current = ordered[ordered.length - 1]
    const next = remaining
      .map((activity, index) => ({
        activity,
        index,
        score: rankNextStop(current, activity, trip),
      }))
      .sort((a, b) => a.score - b.score)[0]

    ordered.push(next.activity)
    remaining.splice(next.index, 1)
  }

  return ordered
}

function orderDayActivities(activities: Activity[], trip: TripDetails) {
  return PERIOD_ORDER.flatMap((period) => {
    const periodActivities = activities.filter((activity) => activity.period === period)
    return orderWithinPeriod(periodActivities, trip)
  })
}

function pressureFor(stopEnd: number, dayEnd: number, travelMinutes: number) {
  if (stopEnd > dayEnd || travelMinutes > 60) return 'tight'
  if (stopEnd > dayEnd - 90 || travelMinutes > 35) return 'steady'
  return 'open'
}

function noteFor(pressure: RouteStop['pressure'], travelMinutes: number) {
  if (pressure === 'tight') return 'Review this stop or shorten nearby activities.'
  if (pressure === 'steady') return travelMinutes > 35 ? 'Travel time is meaningful here.' : 'Schedule is workable with limited buffer.'
  return 'Good buffer around this stop.'
}

function feasibilityFor(route: RouteStop[], dayEnd: number): DayFeasibility {
  const totalActivityMinutes = route.reduce((sum, stop) => sum + stop.durationMinutes, 0)
  const totalTravelMinutes = route.reduce((sum, stop) => sum + stop.travelFromPreviousMinutes, 0)
  const tightStops = route.filter((stop) => stop.pressure === 'tight').length
  const lastStop = route[route.length - 1]
  const lastEnd = lastStop ? clockToMinutes(lastStop.endTime) : DAY_START_MINUTES
  const overrun = Math.max(0, lastEnd - dayEnd)
  const score = Math.max(35, Math.min(98, 100 - tightStops * 14 - overrun * 0.35 - Math.max(0, totalTravelMinutes - 150) * 0.1))

  return {
    score: Math.round(score),
    totalActivityMinutes,
    totalTravelMinutes,
    tightStops,
    summary:
      tightStops > 0
        ? 'This day has a few pressure points that may need trimming.'
        : totalTravelMinutes > 120
          ? 'This day is feasible, but travel time is a major factor.'
          : 'This day has a comfortable travel rhythm.',
  }
}

function clockToMinutes(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number)
  return hours * 60 + minutes
}

function scheduleDay(day: DayPlan, trip: TripDetails): DayPlan {
  const ordered = orderDayActivities(day.activities, trip)
  let cursor = DAY_START_MINUTES
  let previous = ordered.find((activity) => isValidCoordinate(activity.coordinates))?.coordinates

  const route = ordered.flatMap<RouteStop>((activity, index) => {
    if (!isValidCoordinate(activity.coordinates)) return []

    const travelFromPreviousMinutes =
      index === 0 || !previous ? 0 : estimateTravelMinutes(previous, activity.coordinates, trip.transport)
    const start = cursor + travelFromPreviousMinutes
    const durationMinutes = durationFor(activity, trip)
    const end = start + durationMinutes
    const pressure = pressureFor(end, DAY_END_MINUTES, travelFromPreviousMinutes)

    previous = activity.coordinates
    cursor = end

    return [
      {
        id: activity.id ?? stableId(day.day, index, activity.title),
        sequence: index + 1,
        title: activity.title,
        location: activity.location,
        description: activity.description,
        coordinates: activity.coordinates,
        category: activity.category,
        period: activity.period,
        startTime: minutesToClock(start),
        endTime: minutesToClock(end),
        durationMinutes,
        travelFromPreviousMinutes,
        estimatedCost: activity.estimatedCost,
        pressure,
        note: noteFor(pressure, travelFromPreviousMinutes),
      },
    ]
  })

  return {
    ...day,
    route,
    feasibility: feasibilityFor(route, DAY_END_MINUTES),
  }
}

export function optimizeItinerary(itinerary: Itinerary, trip: TripDetails): Itinerary {
  const days = itinerary.days.map((day) => scheduleDay(day, trip))
  const routedLocations = days.flatMap((day) =>
    day.route.map((stop) => ({
      name: stop.title,
      lat: stop.coordinates.lat,
      lng: stop.coordinates.lng,
      type: stop.category,
      sequence: stop.sequence,
    }))
  )
  const mapCenter = averageCenter(
    routedLocations.map((location) => ({ lat: location.lat, lng: location.lng })),
    itinerary.mapCenter
  )
  const feasibilityScore = Math.round(
    days.reduce((sum, day) => sum + day.feasibility.score, 0) / Math.max(1, days.length)
  )

  return {
    ...itinerary,
    trip,
    days,
    mapCenter,
    keyLocations: routedLocations.length > 0 ? routedLocations : itinerary.keyLocations,
    feasibilityScore,
  }
}
