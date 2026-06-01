export type TripStyle = 'relax' | 'culture' | 'adventure' | 'mixed'

export interface TripDetails {
  destination: string
  startDate: string
  endDate: string
  travelers: number
  style: TripStyle
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Activity {
  time: 'morning' | 'afternoon' | 'evening'
  title: string
  description: string
  location: string
  coordinates?: { lat: number; lng: number }
  type: 'food' | 'attraction' | 'transport' | 'accommodation' | 'activity'
}

export interface DayPlan {
  day: number
  date: string
  theme: string
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
  title?: string
}

export interface Itinerary {
  trip: TripDetails
  days: DayPlan[]
  tips: string[]
  summary: string
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

export type CanvasState = 'setup' | 'loading' | 'clarification' | 'itinerary'

export interface SavedTripSummary {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  style: TripStyle
  summary: string
  createdAt: string
  updatedAt: string
}

export interface SavedTrip extends SavedTripSummary {
  itinerary: Itinerary
  messages: Message[]
}
