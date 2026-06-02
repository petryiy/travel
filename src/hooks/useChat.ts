'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  Message,
  TripDetails,
  CanvasState,
  Itinerary,
  ClarificationData,
  GeminiResponse,
  SavedTrip,
  SavedTripSummary,
} from '@/types/travel'

const OWNER_ID_STORAGE_KEY = 'travel-planner-owner-id'

function getOrCreateOwnerId() {
  const stored = window.localStorage.getItem(OWNER_ID_STORAGE_KEY)

  if (stored) return stored

  const id =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(OWNER_ID_STORAGE_KEY, id)
  return id
}

function toSavedTripSummary(trip: SavedTrip): SavedTripSummary {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
    style: trip.style,
    summary: trip.summary,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  }
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [canvasState, setCanvasState] = useState<CanvasState>('setup')
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [clarification, setClarification] = useState<ClarificationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ownerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return getOrCreateOwnerId()
  })
  const [savedTripId, setSavedTripId] = useState<string | null>(null)
  const [savedTrips, setSavedTrips] = useState<SavedTripSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingTrips, setIsLoadingTrips] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadSavedTrips = useCallback(async (id = ownerId) => {
    if (!id) return

    setIsLoadingTrips(true)
    try {
      const res = await fetch(`/api/trips?ownerId=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Unable to load saved trips')

      const data: { trips?: SavedTripSummary[] } = await res.json()
      setSavedTrips(data.trips ?? [])
    } catch {
      setSavedTrips([])
    } finally {
      setIsLoadingTrips(false)
    }
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return

    const timer = window.setTimeout(() => {
      void loadSavedTrips(ownerId)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [ownerId, loadSavedTrips])

  const callGemini = useCallback(async (
    nextMessages: Message[],
    details?: TripDetails,
    currentItinerary?: Itinerary | null
  ) => {
    setIsLoading(true)
    setSaveStatus(null)
    setSaveError(null)
    setCanvasState((prev) => (prev === 'setup' ? 'loading' : prev))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, tripDetails: details, currentItinerary }),
      })

      const data: GeminiResponse = await res.json()

      const assistantMessage: Message = { role: 'assistant', content: data.message }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.canvas.type === 'clarification' && data.canvas.clarification) {
        setClarification(data.canvas.clarification)
        setCanvasState('clarification')
      } else if (data.canvas.type === 'itinerary' && data.canvas.itinerary) {
        setItinerary(data.canvas.itinerary)
        setTripDetails(data.canvas.itinerary.trip)
        setClarification(null)
        setCanvasState('itinerary')
      } else {
        setCanvasState((prev) => (prev === 'loading' ? 'clarification' : prev))
      }
    } catch {
      const errMsg: Message = { role: 'assistant', content: "Sorry, something went wrong. Please try again." }
      setMessages((prev) => [...prev, errMsg])
      setCanvasState('clarification')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const submitSetup = useCallback(async (details: TripDetails) => {
    setTripDetails(details)
    setSavedTripId(null)
    setItinerary(null)
    setClarification(null)
    setSaveStatus(null)
    setSaveError(null)

    const styleLabel = details.style.charAt(0).toUpperCase() + details.style.slice(1)
    const opener: Message = {
      role: 'user',
      content: `I want to plan a trip to ${details.destination}. I'll be traveling from ${details.startDate} to ${details.endDate} with ${details.travelers} traveler${details.travelers > 1 ? 's' : ''}. My preferred style is: ${styleLabel}. My normal daily availability is from ${details.dailyStartTime} to ${details.dailyEndTime}, but you do not need to fill that whole window. Please create a precise time-by-time itinerary with realistic visit durations and travel time between places. Leave open time or finish early when that makes more sense than padding activities.`,
    }

    setMessages([opener])
    await callGemini([opener], details)
  }, [callGemini])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    await callGemini(nextMessages, tripDetails ?? undefined, itinerary)
  }, [messages, tripDetails, itinerary, callGemini])

  const saveCurrentTrip = useCallback(async () => {
    if (!ownerId || !itinerary) return

    setIsSaving(true)
    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, tripId: savedTripId, itinerary, messages }),
      })

      if (!res.ok) throw new Error('Unable to save trip')

      const data: { trip: SavedTrip } = await res.json()
      const summary = toSavedTripSummary(data.trip)

      setSavedTripId(data.trip.id)
      setSavedTrips((prev) => [summary, ...prev.filter((trip) => trip.id !== summary.id)])
      setSaveStatus('Saved to Aurora DSQL')
    } catch {
      setSaveError('Could not save this trip. Check DSQL endpoint and AWS access.')
    } finally {
      setIsSaving(false)
    }
  }, [ownerId, itinerary, savedTripId, messages])

  const openSavedTrip = useCallback(async (tripId: string) => {
    if (!ownerId) return

    setIsLoadingTrips(true)
    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch(`/api/trips/${tripId}?ownerId=${encodeURIComponent(ownerId)}`)
      if (!res.ok) throw new Error('Unable to load trip')

      const data: { trip: SavedTrip } = await res.json()
      setSavedTripId(data.trip.id)
      setMessages(data.trip.messages)
      setItinerary(data.trip.itinerary)
      setTripDetails(data.trip.itinerary.trip)
      setClarification(null)
      setCanvasState('itinerary')
      setSaveStatus('Loaded saved trip')
    } catch {
      setSaveError('Could not open this saved trip.')
    } finally {
      setIsLoadingTrips(false)
    }
  }, [ownerId])

  return {
    messages,
    canvasState,
    tripDetails,
    itinerary,
    clarification,
    isLoading,
    savedTripId,
    savedTrips,
    isSaving,
    isLoadingTrips,
    saveStatus,
    saveError,
    submitSetup,
    sendMessage,
    saveCurrentTrip,
    openSavedTrip,
  }
}
