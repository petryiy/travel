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

export type TravelMode = 'walk' | 'transit' | 'taxi' | 'rideshare' | 'train' | 'light_rail' | 'bus' | 'ferry' | 'flight' | 'other'

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

export type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer'

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
  /** Optimistic-concurrency version; bumped on every itinerary write. */
  version?: number
  /** The current user's role for this trip ('owner' when they own it). */
  role?: CollaboratorRole
  /** Owner's display name — present on trips shared *with* the current user. */
  ownerName?: string | null
}

export interface SavedTrip extends SavedTripSummary {
  itinerary: Itinerary
  messages: Message[]
}

/** A person a trip is shared with (or the owner), as shown in the Share modal. */
export interface Collaborator {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: CollaboratorRole
}

export interface TripLock {
  scope: 'day' | 'ai'
  day: number | null
  userId: string
  userName: string | null
  expiresAt: string
}

export interface TripPresence {
  userId: string
  userName: string | null
  userImage: string | null
}

export interface TripSyncState {
  version: number
  updatedBy: string | null
  role: CollaboratorRole
  locks: TripLock[]
  aiLock: TripLock | null
  presence: TripPresence[]
  commentCount: number
}

export type CommentAnchorType = 'trip' | 'day' | 'activity'

export interface TripComment {
  id: string
  userId: string
  authorName: string | null
  anchorType: CommentAnchorType
  anchorDay: number | null
  anchorActivityId: string | null
  body: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}
