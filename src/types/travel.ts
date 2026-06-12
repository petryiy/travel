export type TripStyle = 'relax' | 'culture' | 'adventure' | 'mixed'

export interface TripDetails {
  destination: string
  accommodationLocation?: string
  startDate: string
  endDate: string
  travelers: number
  style: TripStyle
  dailyStartTime: string
  dailyEndTime: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type TravelMode = 'walk' | 'transit' | 'taxi' | 'rideshare' | 'train' | 'bus' | 'ferry' | 'flight' | 'other'

export interface TravelOption {
  mode: TravelMode
  durationMinutes: number
  description: string
  routeName?: string
  cost?: string
  recommended?: boolean
  source?: 'google' | 'ai'
}

export interface Activity {
  time: 'morning' | 'afternoon' | 'evening'
  startTime?: string
  endTime?: string
  durationMinutes?: number
  travelFromPrevious?: TravelOption | null
  travelOptions?: TravelOption[]
  isFixedTime?: boolean
  title: string
  description: string
  location: string
  coordinates?: { lat: number; lng: number }
  type: 'food' | 'attraction' | 'transport' | 'accommodation' | 'activity'
  hoursNote?: string
  hoursWarning?: string
  hoursSource?: 'google' | 'osm' | 'gemini'
}

export interface DayPlan {
  day: number
  date: string
  theme: string
  startTime?: string
  endTime?: string
  activities: Activity[]
}

export interface KeyLocation {
  name: string
  lat: number
  lng: number
  type?: string
  day?: number
  order?: number
  time?: Activity['time']
  startTime?: string
  endTime?: string
  title?: string
}

export interface Itinerary {
  trip: TripDetails
  days: DayPlan[]
  tips: string[]
  summary: string
  posterCaption?: string
  mapCenter: { lat: number; lng: number }
  keyLocations: KeyLocation[]
}

export interface ClarificationData {
  question: string
  suggestions?: string[]
}

export interface GeminiCanvas {
  type: 'none' | 'clarification' | 'itinerary'
  clarification?: ClarificationData | null
  itinerary?: Itinerary | null
}

export interface GeminiResponse {
  message: string
  canvas: GeminiCanvas
}

export type CanvasState = 'setup' | 'loading' | 'clarification' | 'itinerary' | 'error'

export interface SavedTripSummary {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  style: TripStyle
  summary: string
  isPublished?: boolean
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface SavedTrip extends SavedTripSummary {
  itinerary: Itinerary
  messages: Message[]
}
