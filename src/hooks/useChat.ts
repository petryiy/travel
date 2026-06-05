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
    isPublished: trip.isPublished,
    publishedAt: trip.publishedAt,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  }
}

export function useChat(userId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [canvasState, setCanvasState] = useState<CanvasState>('setup')
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [clarification, setClarification] = useState<ClarificationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savedTripId, setSavedTripId] = useState<string | null>(null)
  const [savedTripTitle, setSavedTripTitle] = useState<string | null>(null)
  const [savedTripIsPublished, setSavedTripIsPublished] = useState(false)
  const [savedTrips, setSavedTrips] = useState<SavedTripSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingTrips, setIsLoadingTrips] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadSavedTrips = useCallback(async () => {
    setIsLoadingTrips(true)
    try {
      const res = await fetch('/api/trips')
      if (!res.ok) throw new Error('Unable to load saved trips')

      const data: { trips?: SavedTripSummary[] } = await res.json()
      setSavedTrips(data.trips ?? [])
    } catch {
      setSavedTrips([])
    } finally {
      setIsLoadingTrips(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedTrips()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSavedTrips])

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
      setCanvasState('error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const submitSetup = useCallback(async (details: TripDetails) => {
    setTripDetails(details)
    setSavedTripId(null)
    setSavedTripTitle(null)
    setSavedTripIsPublished(false)
    setItinerary(null)
    setClarification(null)
    setSaveStatus(null)
    setSaveError(null)

    const styleLabel = details.style.charAt(0).toUpperCase() + details.style.slice(1)
    const opener: Message = {
      role: 'user',
      content: `I want to plan a trip to ${details.destination}. I'll be traveling from ${details.startDate} to ${details.endDate} with ${details.travelers} traveler${details.travelers > 1 ? 's' : ''}. My preferred style is: ${styleLabel}.`,
    }

    setMessages([opener])
    await callGemini([opener], details)
  }, [callGemini])

  const startNewTrip = useCallback(() => {
    setMessages([])
    setCanvasState('setup')
    setTripDetails(null)
    setItinerary(null)
    setClarification(null)
    setSavedTripId(null)
    setSavedTripTitle(null)
    setSavedTripIsPublished(false)
    setSaveStatus(null)
    setSaveError(null)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    await callGemini(nextMessages, tripDetails ?? undefined, itinerary)
  }, [messages, tripDetails, itinerary, callGemini])

  const saveCurrentTrip = useCallback(async () => {
    if (!itinerary) return

    setIsSaving(true)
    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: savedTripId, itinerary, messages }),
      })

      if (!res.ok) throw new Error('Unable to save trip')

      const data: { trip: SavedTrip } = await res.json()
      const summary = toSavedTripSummary(data.trip)

      setSavedTripId(data.trip.id)
      setSavedTripTitle(data.trip.title)
      setSavedTripIsPublished(Boolean(data.trip.isPublished))
      setItinerary(data.trip.itinerary)
      setTripDetails(data.trip.itinerary.trip)
      setSavedTrips((prev) => [summary, ...prev.filter((trip) => trip.id !== summary.id)])
      setSaveStatus('Saved to Aurora DSQL')
    } catch {
      setSaveError('Could not save this trip. Check DSQL endpoint and AWS access.')
    } finally {
      setIsSaving(false)
    }
  }, [itinerary, savedTripId, messages])

  const openSavedTrip = useCallback(async (tripId: string) => {
    setIsLoadingTrips(true)
    setSaveStatus(null)
    setSaveError(null)
    setCanvasState('loading')
    setItinerary(null)
    setClarification(null)

    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) throw new Error('Unable to load trip')

      const data: { trip: SavedTrip } = await res.json()
      setSavedTripId(data.trip.id)
      setSavedTripTitle(data.trip.title)
      setSavedTripIsPublished(Boolean(data.trip.isPublished))
      setMessages(data.trip.messages)
      setItinerary(data.trip.itinerary)
      setTripDetails(data.trip.itinerary.trip)
      setClarification(null)
      setCanvasState('itinerary')
      setSaveStatus('Loaded saved trip')
    } catch {
      setSaveError('Could not open this saved trip.')
      setCanvasState('setup')
    } finally {
      setIsLoadingTrips(false)
    }
  }, [])

  const updateItinerary = useCallback((newItinerary: Itinerary) => {
    setItinerary(newItinerary)
  }, [])

  const retry = useCallback(async () => {
    if (messages.length === 0) return
    await callGemini(messages, tripDetails ?? undefined, itinerary)
  }, [messages, tripDetails, itinerary, callGemini])

  const renameSavedTripTitle = useCallback(async (title: string) => {
    if (!userId || !savedTripId) return false

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setSaveError('Trip title cannot be empty.')
      return false
    }

    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch(`/api/trips/${savedTripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userId, title: cleanTitle }),
      })

      if (!res.ok) throw new Error('Unable to rename trip')

      const data: { trip: SavedTripSummary } = await res.json()
      setSavedTripTitle(data.trip.title)
      setSavedTripIsPublished(Boolean(data.trip.isPublished))
      setSavedTrips((prev) => [data.trip, ...prev.filter((trip) => trip.id !== data.trip.id)])
      setSaveStatus('Renamed trip')
      return true
    } catch {
      setSaveError('Could not rename this trip.')
      return false
    }
  }, [userId, savedTripId])

  const updateSavedTripPublishStatus = useCallback(async (isPublished: boolean) => {
    if (!userId || !savedTripId) return false

    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch(`/api/trips/${savedTripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      })

      if (!res.ok) throw new Error('Unable to update publish status')

      const data: { trip: SavedTripSummary } = await res.json()
      setSavedTripIsPublished(Boolean(data.trip.isPublished))
      setSavedTrips((prev) => [data.trip, ...prev.filter((trip) => trip.id !== data.trip.id)])
      setSaveStatus(data.trip.isPublished ? 'Published to gallery' : 'Removed from gallery')
      return true
    } catch {
      setSaveError('Could not update gallery publishing.')
      return false
    }
  }, [userId, savedTripId])

  return {
    messages,
    canvasState,
    tripDetails,
    itinerary,
    clarification,
    isLoading,
    savedTripId,
    savedTripTitle,
    savedTripIsPublished,
    savedTrips,
    isSaving,
    isLoadingTrips,
    saveStatus,
    saveError,
    submitSetup,
    startNewTrip,
    sendMessage,
    updateItinerary,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
    updateSavedTripPublishStatus,
    retry,
  }
}
