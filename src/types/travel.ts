export type TripStyle = 'relaxed' | 'culture' | 'adventure' | 'food' | 'mixed'
export type Pace = 'easy' | 'balanced' | 'packed'
export type BudgetLevel = 'lean' | 'balanced' | 'premium'
export type TransportMode = 'walking' | 'transit' | 'driving'
export type ActivityPeriod = 'morning' | 'midday' | 'afternoon' | 'evening'
export type ActivityCategory =
  | 'food'
  | 'attraction'
  | 'transport'
  | 'accommodation'
  | 'activity'
  | 'shopping'
  | 'nightlife'
export type PressureLevel = 'open' | 'steady' | 'tight'

export interface TripDetails {
  destination: string
  startDate: string
  endDate: string
  travelers: number
  style: TripStyle
  pace: Pace
  budget: BudgetLevel
  transport: TransportMode
  homeBase?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Coordinates {
  lat: number
  lng: number
}

export interface Activity {
  id?: string
  period: ActivityPeriod
  title: string
  description: string
  location: string
  coordinates?: Coordinates
  category: ActivityCategory
  durationMinutes?: number
  estimatedCost?: number
  bookingHint?: string
  priority?: number
}

export interface RouteStop {
  id: string
  sequence: number
  title: string
  location: string
  description: string
  coordinates: Coordinates
  category: ActivityCategory
  period: ActivityPeriod
  startTime: string
  endTime: string
  durationMinutes: number
  travelFromPreviousMinutes: number
  estimatedCost?: number
  pressure: PressureLevel
  note: string
}

export interface DayFeasibility {
  score: number
  totalActivityMinutes: number
  totalTravelMinutes: number
  tightStops: number
  summary: string
}

export interface DayPlan {
  day: number
  date: string
  theme: string
  summary: string
  activities: Activity[]
  route: RouteStop[]
  feasibility: DayFeasibility
}

export interface KeyLocation {
  name: string
  lat: number
  lng: number
  type?: ActivityCategory | string
  sequence?: number
}

export interface Itinerary {
  id?: string
  trip: TripDetails
  days: DayPlan[]
  tips: string[]
  summary: string
  mapCenter: Coordinates
  keyLocations: KeyLocation[]
  feasibilityScore: number
  savedAt?: string
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

export interface StorageState {
  configured: boolean
  status: 'idle' | 'saving' | 'saved' | 'unavailable' | 'error'
  message: string
  lastSavedAt?: string
}

export type CanvasState = 'setup' | 'loading' | 'clarification' | 'itinerary'
