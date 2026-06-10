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
  CanvasTab,
  HotelsCanvas,
  FlightsCanvas,
  HotelSuggestion,
  FlightOption,
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
  const [activeTab, setActiveTab] = useState<CanvasTab>('itinerary')
  const [hotelCanvas, setHotelCanvas] = useState<HotelsCanvas | null>(null)
  const [flightCanvas, setFlightCanvas] = useState<FlightsCanvas | null>(null)
  const [pendingFlightOrigin, setPendingFlightOrigin] = useState<string | null>(null)

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

  const checkHours = useCallback(async (newItinerary: Itinerary) => {
    const activities = newItinerary.days.flatMap((day, dayIdx) =>
      day.activities
        .filter((act) => act.coordinates && act.startTime)
        .map((act, actIdx) => ({
          dayIdx,
          actIdx,
          locationName: act.location,
          lat: act.coordinates!.lat,
          lng: act.coordinates!.lng,
          date: day.date,
          startTime: act.startTime!,
        }))
    )
    if (activities.length === 0) return

    try {
      const res = await fetch('/api/check-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities }),
      })
      const data: { results: Array<{ dayIdx: number; actIdx: number; source: string; hoursNote: string | null; hoursWarning: string | null }> } = await res.json()

      setItinerary((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          days: prev.days.map((day, di) => ({
            ...day,
            activities: day.activities.map((act, ai) => {
              const result = data.results.find((r) => r.dayIdx === di && r.actIdx === ai)
              if (!result || result.source === 'none') return act
              return {
                ...act,
                hoursNote: result.hoursNote ?? act.hoursNote,
                hoursWarning: result.hoursWarning ?? act.hoursWarning,
                hoursSource: result.source as 'google' | 'osm',
              }
            }),
          })),
        }
      })
    } catch {
      // hours check is non-critical; silently ignore errors
    }
  }, [])

  const fetchHotels = useCallback(async (
    currentItinerary: Itinerary,
    opts: { notes?: string } = {},
  ) => {
    const { destination, startDate, endDate, travelers } = currentItinerary.trip
    setHotelCanvas({ panelState: 'searching', data: null })
    try {
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, checkIn: startDate, checkOut: endDate, guests: travelers }),
      })
      const data = await res.json() as { suggestions?: HotelSuggestion[]; source?: 'travelpayouts' | 'fallback' }
      setHotelCanvas({
        panelState: 'results',
        data: {
          cityName: destination,
          checkIn: startDate,
          checkOut: endDate,
          guests: travelers,
          geminiNote: opts.notes ?? '',
          suggestions: data.suggestions ?? [],
          source: data.source ?? 'fallback',
        },
      })
    } catch {
      setHotelCanvas({ panelState: 'error', data: null, errorMessage: 'Could not load hotel suggestions.' })
    }
  }, [])

  const fetchFlights = useCallback(async (
    currentItinerary: Itinerary,
    opts: { originCode?: string | null; notes?: string } = {},
  ) => {
    const { destination, startDate, endDate, travelers } = currentItinerary.trip
    setFlightCanvas({ panelState: 'searching', data: null })
    try {
      const res = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: opts.originCode ?? 'Unknown',
          destination,
          departureDate: startDate,
          returnDate: endDate,
          passengers: travelers,
          originCode: opts.originCode ?? null,
        }),
      })
      const data = await res.json() as { options?: FlightOption[]; source?: 'travelpayouts' | 'fallback' }
      setFlightCanvas({
        panelState: 'results',
        data: {
          originCity: opts.originCode ?? 'Your city',
          destinationCity: destination,
          departureDate: startDate,
          returnDate: endDate,
          passengers: travelers,
          geminiNote: opts.notes ?? '',
          options: data.options ?? [],
          source: data.source ?? 'fallback',
        },
      })
    } catch {
      setFlightCanvas({ panelState: 'error', data: null, errorMessage: 'Could not load flight options.' })
    }
  }, [])

  const callGemini = useCallback(async (
    nextMessages: Message[],
    details?: TripDetails,
    currentItinerary?: Itinerary | null,
    tabContext?: 'hotels' | 'flights',
  ) => {
    setIsLoading(true)
    setSaveStatus(null)
    setSaveError(null)
    setCanvasState((prev) => (prev === 'setup' ? 'loading' : prev))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, tripDetails: details, currentItinerary, tabContext }),
      })

      const data: GeminiResponse = await res.json()

      const assistantMessage: Message = { role: 'assistant', content: data.message }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.canvas.type === 'hotels') {
        const payload = data.canvas.hotels
        if (payload?.question) {
          setHotelCanvas({ panelState: 'asking', question: payload.question, questionSuggestions: payload.suggestions, data: null })
        } else if (payload?.searchReady && currentItinerary) {
          void fetchHotels(currentItinerary, { notes: payload.notes })
        }
      } else if (data.canvas.type === 'flights') {
        const payload = data.canvas.flights
        if (payload?.question) {
          setFlightCanvas({ panelState: 'asking', question: payload.question, questionSuggestions: payload.suggestions, data: null })
          if (payload.originCode) setPendingFlightOrigin(payload.originCode)
        } else if (payload?.searchReady && currentItinerary) {
          setPendingFlightOrigin(payload.originCode ?? null)
          void fetchFlights(currentItinerary, { originCode: payload.originCode, notes: payload.notes })
        }
      } else if (data.canvas.type === 'clarification' && data.canvas.clarification) {
        setClarification(data.canvas.clarification)
        setCanvasState('clarification')
      } else if (data.canvas.type === 'itinerary' && data.canvas.itinerary) {
        setItinerary(data.canvas.itinerary)
        setTripDetails(data.canvas.itinerary.trip)
        setClarification(null)
        setCanvasState('itinerary')
        void checkHours(data.canvas.itinerary)
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
  }, [checkHours, fetchHotels, fetchFlights])

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
    setActiveTab('itinerary')
    setHotelCanvas(null)
    setFlightCanvas(null)
    setPendingFlightOrigin(null)
  }, [])

  const switchTab = useCallback((tab: CanvasTab) => {
    setActiveTab(tab)

    if (tab === 'hotels' && hotelCanvas === null && itinerary) {
      // Fetch real hotel data immediately — no Gemini dependency
      void fetchHotels(itinerary)
      // Also send a chat message so Gemini gives a recommendation blurb
      const msg = `I'm looking at hotels for my trip to ${itinerary.trip.destination}. Can you give me a quick overview of what areas to consider?`
      const userMessage: Message = { role: 'user', content: msg }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      void callGemini(nextMessages, tripDetails ?? undefined, undefined, 'hotels')
    }

    if (tab === 'flights' && flightCanvas === null && itinerary) {
      // Set the asking state directly — don't wait for Gemini to return the question
      setFlightCanvas({
        panelState: 'asking',
        question: `Where are you flying from to reach ${itinerary.trip.destination}?`,
        questionSuggestions: ['New York (JFK)', 'London (LHR)', 'Los Angeles (LAX)', 'Toronto (YYZ)', 'Sydney (SYD)', 'Tokyo (NRT)'],
        data: null,
      })
      // Also open the chat conversation
      const msg = `I'm looking for flights to ${itinerary.trip.destination}.`
      const userMessage: Message = { role: 'user', content: msg }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      void callGemini(nextMessages, tripDetails ?? undefined, undefined, 'flights')
    }
  }, [hotelCanvas, flightCanvas, itinerary, messages, tripDetails, callGemini, fetchHotels])

  // Called when user selects a departure airport (from chip or parsed from chat)
  const selectFlightOrigin = useCallback((originCode: string, originLabel: string) => {
    if (!itinerary) return
    setPendingFlightOrigin(originCode)
    void fetchFlights(itinerary, { originCode, notes: '' })
    // Echo in chat
    const userMessage: Message = { role: 'user', content: `Flying from ${originLabel}` }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    void callGemini(nextMessages, tripDetails ?? undefined, undefined, 'flights')
  }, [itinerary, fetchFlights, messages, tripDetails, callGemini])

  const sendMessage = useCallback(async (text: string, opts?: { tabContext?: 'hotels' | 'flights' }) => {
    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    await callGemini(nextMessages, tripDetails ?? undefined, itinerary, opts?.tabContext)
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

  const retryHotels = useCallback(() => {
    if (itinerary) void fetchHotels(itinerary)
  }, [itinerary, fetchHotels])

  const retryFlights = useCallback(() => {
    if (itinerary) void fetchFlights(itinerary, { originCode: pendingFlightOrigin })
  }, [itinerary, fetchFlights, pendingFlightOrigin])

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
    activeTab,
    hotelCanvas,
    flightCanvas,
    submitSetup,
    startNewTrip,
    sendMessage,
    switchTab,
    selectFlightOrigin,
    retryHotels,
    retryFlights,
    updateItinerary,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
    updateSavedTripPublishStatus,
    retry,
  }
}
