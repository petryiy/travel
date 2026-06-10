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

export interface Activity {
  time: 'morning' | 'afternoon' | 'evening'
  startTime?: string
  endTime?: string
  durationMinutes?: number
  travelFromPrevious?: {
    mode: 'walk' | 'transit' | 'taxi' | 'rideshare' | 'train' | 'bus' | 'ferry' | 'flight' | 'other'
    durationMinutes: number
    description: string
  } | null
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

export interface HotelsGeminiPayload {
  question?: string
  suggestions?: string[]
  searchReady?: boolean
  notes?: string
}

export interface FlightsGeminiPayload {
  question?: string
  suggestions?: string[]
  searchReady?: boolean
  originCode?: string | null
  notes?: string
}

export interface GeminiCanvas {
  type: 'none' | 'clarification' | 'itinerary' | 'hotels' | 'flights'
  clarification?: ClarificationData | null
  itinerary?: Itinerary | null
  hotels?: HotelsGeminiPayload | null
  flights?: FlightsGeminiPayload | null
}

export type CanvasTab = 'itinerary' | 'hotels' | 'flights'

export type HotelPanelState = 'idle' | 'asking' | 'searching' | 'results' | 'error'

export interface HotelSuggestion {
  id: string
  name: string
  stars: number | null
  pricePerNight: number | null
  currency: string
  neighborhood: string
  highlights: string[]
  bookingUrl: string
  googleHotelsUrl: string
  primaryLabel?: string   // overrides "Booking.com ↗" button text
  secondaryLabel?: string // overrides "Google Hotels ↗" button text
}

export interface HotelCanvasData {
  cityName: string
  checkIn: string
  checkOut: string
  guests: number
  geminiNote: string
  suggestions: HotelSuggestion[]
  source: 'travelpayouts' | 'amadeus' | 'fallback'
}

export interface HotelsCanvas {
  panelState: HotelPanelState
  question?: string
  questionSuggestions?: string[]
  data: HotelCanvasData | null
  errorMessage?: string
}

export type FlightPanelState = 'idle' | 'asking' | 'searching' | 'results' | 'error'

export interface FlightOption {
  id: string
  airline: string | null
  from: string
  to: string
  departureDate: string
  durationMinutes: number | null
  stops: number
  totalPrice: number | null
  currency: string
  skyscannerUrl: string
  googleFlightsUrl: string
  source: 'travelpayouts' | 'amadeus' | 'fallback'
}

export interface FlightCanvasData {
  originCity: string
  destinationCity: string
  departureDate: string
  returnDate: string | null
  passengers: number
  geminiNote: string
  options: FlightOption[]
  source: 'travelpayouts' | 'amadeus' | 'fallback'
}

export interface FlightsCanvas {
  panelState: FlightPanelState
  question?: string
  questionSuggestions?: string[]
  data: FlightCanvasData | null
  errorMessage?: string
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
