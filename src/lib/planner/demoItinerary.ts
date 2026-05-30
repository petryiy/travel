import type { Itinerary, TripDetails } from '@/types/travel'
import { optimizeItinerary } from './scheduler'

const addDays = (date: string, offset: number) => {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + offset)
  return value.toISOString().slice(0, 10)
}

export function createDemoItinerary(trip: TripDetails): Itinerary {
  const startDate = trip.startDate || new Date().toISOString().slice(0, 10)
  const base: Itinerary = {
    trip,
    summary:
      'A balanced city plan that blends landmark stops, local food, and realistic travel buffers.',
    feasibilityScore: 84,
    mapCenter: { lat: -33.8688, lng: 151.2093 },
    keyLocations: [],
    tips: [
      'Keep one flexible block each day for weather, lines, or local recommendations.',
      'Book popular restaurants and timed-entry museums before the trip.',
      'Use the feasibility score to decide whether a day needs trimming.',
    ],
    days: [
      {
        day: 1,
        date: startDate,
        theme: 'Arrival and signature sights',
        summary: 'Start with a gentle first day that covers the city center without overloading the schedule.',
        feasibility: {
          score: 0,
          totalActivityMinutes: 0,
          totalTravelMinutes: 0,
          tightStops: 0,
          summary: '',
        },
        route: [],
        activities: [
          {
            period: 'morning',
            title: 'Harbor orientation walk',
            description: 'Ease into the trip with a scenic route around the waterfront and major viewpoints.',
            location: 'Circular Quay',
            coordinates: { lat: -33.8611, lng: 151.2131 },
            category: 'attraction',
            durationMinutes: 80,
            estimatedCost: 0,
            priority: 5,
          },
          {
            period: 'midday',
            title: 'Local lunch market',
            description: 'Choose a casual lunch spot with quick service and a strong sense of place.',
            location: 'The Rocks',
            coordinates: { lat: -33.8599, lng: 151.2090 },
            category: 'food',
            durationMinutes: 70,
            estimatedCost: 28,
            priority: 4,
          },
          {
            period: 'afternoon',
            title: 'Garden and gallery loop',
            description: 'Pair a quiet green space with a nearby cultural stop for a relaxed afternoon.',
            location: 'Royal Botanic Garden',
            coordinates: { lat: -33.8642, lng: 151.2165 },
            category: 'activity',
            durationMinutes: 100,
            estimatedCost: 18,
            priority: 4,
          },
        ],
      },
      {
        day: 2,
        date: addDays(startDate, 1),
        theme: 'Neighborhood depth and coastal time',
        summary: 'Use the second day for a stronger local rhythm and one memorable scenic segment.',
        feasibility: {
          score: 0,
          totalActivityMinutes: 0,
          totalTravelMinutes: 0,
          tightStops: 0,
          summary: '',
        },
        route: [],
        activities: [
          {
            period: 'morning',
            title: 'Independent cafe start',
            description: 'Start late enough to avoid commuter pressure while still getting a local breakfast.',
            location: 'Surry Hills',
            coordinates: { lat: -33.8846, lng: 151.2120 },
            category: 'food',
            durationMinutes: 65,
            estimatedCost: 24,
            priority: 4,
          },
          {
            period: 'afternoon',
            title: 'Coastal viewpoint walk',
            description: 'Add a scenic outdoor block that gives the trip a clear visual highlight.',
            location: 'Bondi Beach',
            coordinates: { lat: -33.8915, lng: 151.2767 },
            category: 'activity',
            durationMinutes: 120,
            estimatedCost: 0,
            priority: 5,
          },
          {
            period: 'evening',
            title: 'Dinner near the water',
            description: 'Finish near transit options so the evening remains easy to manage.',
            location: 'Darling Harbour',
            coordinates: { lat: -33.8735, lng: 151.2006 },
            category: 'food',
            durationMinutes: 90,
            estimatedCost: 42,
            priority: 4,
          },
        ],
      },
    ],
  }

  return optimizeItinerary(base, trip)
}
