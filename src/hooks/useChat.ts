'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { getInclusiveTripDayCount } from '@/lib/tripDates'
import type {
  Message,
  TripDetails,
  CanvasState,
  Itinerary,
  ClarificationData,
  GeminiResponse,
  SavedTrip,
  SavedTripSummary,
  TravelOption,
  Collaborator,
  CollaboratorRole,
  TripComment,
  CommentAnchorType,
  TripLock,
  TripPresence,
  TripSyncState,
} from '@/types/travel'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const POLL_INTERVAL_MS = 4000
const HEARTBEAT_INTERVAL_MS = 10_000
const AUTOSAVE_DEBOUNCE_MS = 1500

interface CommentAnchor {
  type: CommentAnchorType
  day?: number | null
  activityId?: string | null
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
    isPublished: trip.isPublished,
    publishedAt: trip.publishedAt,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    version: trip.version,
    role: trip.role,
    ownerName: trip.ownerName,
  }
}

interface RoutePoint {
  lat: number
  lng: number
  name?: string
}

interface RouteSegment {
  dayIdx: number
  actIdx: number
  date: string
  departureTime?: string
  origin: RoutePoint
  destination: RoutePoint
}

interface RouteResult {
  dayIdx: number
  actIdx: number
  origin?: RoutePoint
  destination?: RoutePoint
  options: TravelOption[]
}

function buildRouteSegments(source: Itinerary) {
  const segments: RouteSegment[] = []

  source.days.forEach((day, dayIdx) => {
    day.activities.forEach((activity, actIdx) => {
      if (actIdx === 0) return
      const previous = day.activities[actIdx - 1]
      if (!previous.coordinates || !activity.coordinates) return

      segments.push({
        dayIdx,
        actIdx,
        date: day.date,
        departureTime: previous.endTime ?? activity.startTime,
        origin: { ...previous.coordinates, name: previous.location },
        destination: { ...activity.coordinates, name: activity.location },
      })
    })
  })

  return segments
}

function closePoint(a?: RoutePoint, b?: { lat: number; lng: number }) {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lng - b.lng) < 0.0005
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
  // Collaboration: version drives optimistic-concurrency; tripRole is the
  // current user's permission for the open trip (null for a brand-new trip).
  const [version, setVersion] = useState<number | null>(null)
  const [tripRole, setTripRole] = useState<CollaboratorRole | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [collaboratorsCanManage, setCollaboratorsCanManage] = useState(false)
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false)
  const [comments, setComments] = useState<TripComment[]>([])
  const [dayLocks, setDayLocks] = useState<TripLock[]>([])
  const [aiLock, setAiLock] = useState<TripLock | null>(null)
  const [presence, setPresence] = useState<TripPresence[]>([])
  const [heldDay, setHeldDay] = useState<number | null>(null)

  // A trip is "collaborative" once it is saved and either shared with the user
  // or has at least one non-owner collaborator. Solo trips skip all of the
  // polling / locking / autosave machinery below.
  const hasOtherCollaborators = collaborators.some((c) => c.role !== 'owner')
  const isCollaborativeTrip = Boolean(savedTripId) && (tripRole !== 'owner' || hasOtherCollaborators)
  const canEditTrip = tripRole == null || tripRole === 'owner' || tripRole === 'editor'

  // Snapshot of the live values needed inside intervals / async callbacks
  // without re-creating them (avoids stale closures and effect churn).
  const liveRef = useRef({
    version, itinerary, messages, savedTripId, tripRole, heldDay,
    isCollaborative: isCollaborativeTrip, canEdit: canEditTrip,
  })
  useEffect(() => {
    liveRef.current = {
      version, itinerary, messages, savedTripId, tripRole, heldDay,
      isCollaborative: isCollaborativeTrip, canEdit: canEditTrip,
    }
  })
  const aiRunningRef = useRef(false)
  const autosaveTimerRef = useRef<number | null>(null)

  // Pull the latest server copy of a trip. When the user currently holds a day
  // lock and has local edits to that day, those edits are preserved (day-merge).
  const refetchTrip = useCallback(async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) return null
      const data: { trip: SavedTrip } = await res.json()
      const server = data.trip.itinerary
      const live = liveRef.current
      let merged = server
      if (live.heldDay != null && live.itinerary) {
        const myDay = live.itinerary.days.find((d) => d.day === live.heldDay)
        if (myDay) merged = { ...server, days: server.days.map((d) => (d.day === live.heldDay ? myDay : d)) }
      }
      const newVersion = typeof data.trip.version === 'number' ? data.trip.version : null
      setItinerary(merged)
      setTripDetails(merged.trip)
      setSavedTripTitle(data.trip.title)
      setMessages(data.trip.messages ?? [])
      setVersion(newVersion)
      return { itinerary: merged, version: newVersion, messages: data.trip.messages ?? [] }
    } catch {
      return null
    }
  }, [])

  // Debounced autosave for manual edits on a collaborative trip. On a version
  // conflict it day-merges the fresh server copy and retries once.
  const autosaveNow = useCallback(async () => {
    const live = liveRef.current
    if (!live.savedTripId || !live.itinerary || !live.canEdit) return
    const tripId = live.savedTripId
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ tripId, itinerary: live.itinerary, messages: live.messages, expectedVersion: live.version ?? undefined }),
      })
      if (res.status === 409) {
        const fresh = await refetchTrip(tripId)
        if (fresh) {
          const retry = await fetch('/api/trips', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ tripId, itinerary: fresh.itinerary, messages: fresh.messages, expectedVersion: fresh.version ?? undefined }),
          })
          if (retry.ok) {
            const d: { trip: SavedTrip } = await retry.json()
            setVersion(typeof d.trip.version === 'number' ? d.trip.version : null)
          }
        }
        return
      }
      if (res.ok) {
        const d: { trip: SavedTrip } = await res.json()
        setVersion(typeof d.trip.version === 'number' ? d.trip.version : null)
      }
    } catch {
      // transient; the next edit (or manual Save) will retry
    }
  }, [refetchTrip])

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      void autosaveNow()
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [autosaveNow])

  // Save an AI-generated itinerary immediately so collaborators see it. The AI
  // rewrites the whole plan, so on conflict it force-saves over the latest.
  const saveItineraryNow = useCallback(async (itin: Itinerary, msgs: Message[]) => {
    const tripId = liveRef.current.savedTripId
    if (!tripId) return
    const attempt = (expected: number | null) =>
      fetch('/api/trips', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ tripId, itinerary: itin, messages: msgs, expectedVersion: expected ?? undefined }),
      })
    try {
      let res = await attempt(liveRef.current.version)
      if (res.status === 409) {
        const cur = await fetch(`/api/trips/${tripId}`)
        if (cur.ok) {
          const d: { trip: SavedTrip } = await cur.json()
          res = await attempt(typeof d.trip.version === 'number' ? d.trip.version : null)
        }
      }
      if (res.ok) {
        const d: { trip: SavedTrip } = await res.json()
        setVersion(typeof d.trip.version === 'number' ? d.trip.version : null)
      }
    } catch {
      // best-effort; the manual Save button remains as a fallback
    }
  }, [])

  const acquireAiLock = useCallback(async () => {
    const tripId = liveRef.current.savedTripId
    if (!tripId || !liveRef.current.isCollaborative) return true
    try {
      const res = await fetch(`/api/trips/${tripId}/locks`, {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ scope: 'ai' }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  const releaseAiLock = useCallback(async () => {
    const tripId = liveRef.current.savedTripId
    if (!tripId) return
    try {
      await fetch(`/api/trips/${tripId}/locks`, {
        method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ keys: ['ai'] }),
      })
    } catch {
      // expiry is the backstop
    }
  }, [])

  // Acquire the lock for the day the editor is on. Releases the previously held
  // day. For a solo trip we just record the active day so editing stays enabled.
  const acquireDayLock = useCallback(async (dayNumber: number | null) => {
    const live = liveRef.current
    const tripId = live.savedTripId
    if (!tripId || !live.isCollaborative || !live.canEdit) {
      setHeldDay(dayNumber)
      return
    }
    const prev = live.heldDay
    if (prev != null && prev !== dayNumber) {
      try {
        await fetch(`/api/trips/${tripId}/locks`, {
          method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ keys: [`day:${prev}`] }),
        })
      } catch {
        // ignore; it will expire
      }
    }
    if (dayNumber == null) {
      setHeldDay(null)
      return
    }
    try {
      const res = await fetch(`/api/trips/${tripId}/locks`, {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ scope: 'day', day: dayNumber }),
      })
      setHeldDay(res.ok ? dayNumber : null)
    } catch {
      setHeldDay(null)
    }
  }, [])

  // Poll the sync endpoint while a collaborative trip is open.
  useEffect(() => {
    if (!isCollaborativeTrip || !savedTripId) return
    let cancelled = false
    let timer: number | undefined
    const poll = async () => {
      try {
        const res = await fetch(`/api/trips/${savedTripId}/sync`, { cache: 'no-store' })
        if (res.ok && !cancelled) {
          const data: TripSyncState = await res.json()
          setDayLocks(data.locks ?? [])
          setAiLock(data.aiLock ?? null)
          setPresence(data.presence ?? [])
          const live = liveRef.current
          if (typeof data.version === 'number' && data.version !== live.version) {
            if (data.updatedBy && data.updatedBy !== userId) {
              await refetchTrip(savedTripId)
            } else {
              setVersion(data.version)
            }
          }
        }
      } catch {
        // transient network error; keep polling
      }
      if (!cancelled) timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    }
    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      // Clear stale collaborators' locks/presence when leaving the trip.
      setDayLocks([])
      setAiLock(null)
      setPresence([])
    }
  }, [isCollaborativeTrip, savedTripId, userId, refetchTrip])

  // Heartbeat the locks we hold (day lock, plus the AI lock during a run).
  useEffect(() => {
    if (!isCollaborativeTrip || !savedTripId) return
    const beat = async () => {
      const keys: string[] = []
      if (liveRef.current.heldDay != null) keys.push(`day:${liveRef.current.heldDay}`)
      if (aiRunningRef.current) keys.push('ai')
      if (keys.length === 0) return
      try {
        const res = await fetch(`/api/trips/${savedTripId}/locks`, {
          method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ keys }),
        })
        if (res.ok) {
          const data: { held?: string[] } = await res.json()
          const day = liveRef.current.heldDay
          if (day != null && !(data.held ?? []).includes(`day:${day}`)) setHeldDay(null)
        }
      } catch {
        // ignore
      }
    }
    const interval = window.setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isCollaborativeTrip, savedTripId])

  // Release locks when leaving a trip (switch or unmount) and on tab close.
  useEffect(() => {
    if (!savedTripId) return
    const tripId = savedTripId
    return () => {
      try {
        navigator.sendBeacon?.(`/api/trips/${tripId}/locks/release`)
      } catch {
        // ignore
      }
    }
  }, [savedTripId])

  useEffect(() => {
    const handler = () => {
      const tripId = liveRef.current.savedTripId
      if (tripId) {
        try {
          navigator.sendBeacon(`/api/trips/${tripId}/locks/release`)
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [])

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

  const enrichRoutes = useCallback(async (newItinerary: Itinerary) => {
    const segments = buildRouteSegments(newItinerary)
    if (segments.length === 0) return

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }),
      })
      const data: { results?: RouteResult[] } = await res.json()
      const results = data.results ?? []
      if (results.length === 0) return

      setItinerary((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          days: prev.days.map((day, di) => ({
            ...day,
            activities: day.activities.map((act, ai) => {
              const result = results.find((r) => r.dayIdx === di && r.actIdx === ai)
              const previous = day.activities[ai - 1]
              if (!result?.options.length || !previous?.coordinates || !act.coordinates) return act
              if (!closePoint(result.origin, previous.coordinates) || !closePoint(result.destination, act.coordinates)) return act

              return {
                ...act,
                travelFromPrevious: result.options[0] ?? act.travelFromPrevious,
                travelOptions: result.options,
              }
            }),
          })),
        }
      })
    } catch {
      // route enrichment is non-critical; keep the AI-estimated travel data
    }
  }, [])

  const callGemini = useCallback(async (
    nextMessages: Message[],
    details?: TripDetails,
    currentItinerary?: Itinerary | null
  ) => {
    setIsLoading(true)
    setSaveStatus(null)
    setSaveError(null)
    setCanvasState((prev) => (prev === 'setup' ? 'loading' : prev))

    // On a collaborative trip only one AI run may mutate the plan at a time.
    const collab = liveRef.current.isCollaborative && Boolean(liveRef.current.savedTripId)
    if (collab) {
      const got = await acquireAiLock()
      if (!got) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Someone else is updating this plan with AI right now. Please try again in a moment.' },
        ])
        setIsLoading(false)
        setCanvasState((prev) => (prev === 'loading' ? 'itinerary' : prev))
        return
      }
      aiRunningRef.current = true
    }

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
        const newItinerary = data.canvas.itinerary
        setItinerary(newItinerary)
        setTripDetails(newItinerary.trip)
        setClarification(null)
        setCanvasState('itinerary')
        void checkHours(newItinerary)
        void enrichRoutes(newItinerary)
        // Persist immediately so collaborators see the AI edit on their next poll.
        if (collab && liveRef.current.savedTripId) {
          await saveItineraryNow(newItinerary, [...nextMessages, assistantMessage])
        }
      } else {
        setCanvasState((prev) => (prev === 'loading' ? 'clarification' : prev))
      }
    } catch {
      const errMsg: Message = { role: 'assistant', content: "Sorry, something went wrong. Please try again." }
      setMessages((prev) => [...prev, errMsg])
      setCanvasState('error')
    } finally {
      setIsLoading(false)
      if (collab) {
        aiRunningRef.current = false
        void releaseAiLock()
      }
    }
  }, [checkHours, enrichRoutes, acquireAiLock, releaseAiLock, saveItineraryNow])

  const submitSetup = useCallback(async (details: TripDetails) => {
    setTripDetails(details)
    setSavedTripId(null)
    setSavedTripTitle(null)
    setSavedTripIsPublished(false)
    setItinerary(null)
    setClarification(null)
    setSaveStatus(null)
    setSaveError(null)
    setVersion(null)
    setTripRole(null)
    setCollaborators([])
    setComments([])
    setHeldDay(null)
    setDayLocks([])
    setAiLock(null)
    setPresence([])

    const styleLabel = details.style.charAt(0).toUpperCase() + details.style.slice(1)
    const dayCount = getInclusiveTripDayCount(details.startDate, details.endDate)
    const opener: Message = {
      role: 'user',
      content: `I want to plan a ${dayCount}-day trip to ${details.destination}. I'll be traveling from ${details.startDate} to ${details.endDate} with ${details.travelers} traveler${details.travelers > 1 ? 's' : ''}. My preferred style is: ${styleLabel}.`,
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
    setVersion(null)
    setTripRole(null)
    setCollaborators([])
    setComments([])
    setHeldDay(null)
    setDayLocks([])
    setAiLock(null)
    setPresence([])
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
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
        body: JSON.stringify({
          tripId: savedTripId,
          itinerary,
          messages,
          expectedVersion: savedTripId ? version ?? undefined : undefined,
        }),
      })

      // Another collaborator saved first. Reload the latest server copy so the
      // user can re-apply their change. (M3 replaces this with a day-merge.)
      if (res.status === 409 && savedTripId) {
        setSaveError('This plan was just updated by someone else — reloaded the latest version.')
        try {
          const fresh = await fetch(`/api/trips/${savedTripId}`)
          if (fresh.ok) {
            const fd: { trip: SavedTrip } = await fresh.json()
            setItinerary(fd.trip.itinerary)
            setTripDetails(fd.trip.itinerary.trip)
            setSavedTripTitle(fd.trip.title)
            setMessages(fd.trip.messages ?? [])
            setVersion(typeof fd.trip.version === 'number' ? fd.trip.version : null)
            setTripRole(fd.trip.role ?? null)
          }
        } catch {
          // leave the local copy in place if the reload fails
        }
        return
      }

      if (res.status === 403) {
        setSaveError('You have view-only access to this plan.')
        return
      }

      if (!res.ok) throw new Error('Unable to save trip')

      const data: { trip: SavedTrip } = await res.json()
      const summary = toSavedTripSummary(data.trip)

      setSavedTripId(data.trip.id)
      setSavedTripTitle(data.trip.title)
      setSavedTripIsPublished(Boolean(data.trip.isPublished))
      setItinerary(data.trip.itinerary)
      setTripDetails(data.trip.itinerary.trip)
      setVersion(typeof data.trip.version === 'number' ? data.trip.version : null)
      setTripRole(data.trip.role ?? 'owner')
      setSavedTrips((prev) => [summary, ...prev.filter((trip) => trip.id !== summary.id)])
      setSaveStatus('Saved to Aurora DSQL')
    } catch {
      setSaveError('Could not save this trip. Check DSQL endpoint and AWS access.')
    } finally {
      setIsSaving(false)
    }
  }, [itinerary, savedTripId, messages, version])

  const openSavedTrip = useCallback(async (tripId: string) => {
    setIsLoadingTrips(true)
    setSaveStatus(null)
    setSaveError(null)
    setCanvasState('loading')
    setItinerary(null)
    setClarification(null)
    setHeldDay(null)
    setDayLocks([])
    setAiLock(null)
    setPresence([])
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)

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
      setVersion(typeof data.trip.version === 'number' ? data.trip.version : null)
      setTripRole(data.trip.role ?? 'owner')
      setCollaborators([])
      setClarification(null)
      setCanvasState('itinerary')
      setSaveStatus('Loaded saved trip')
      void enrichRoutes(data.trip.itinerary)
      void (async () => {
        try {
          const cres = await fetch(`/api/trips/${tripId}/comments`)
          if (cres.ok) {
            const cd: { comments?: TripComment[] } = await cres.json()
            setComments(cd.comments ?? [])
          } else {
            setComments([])
          }
        } catch {
          setComments([])
        }
      })()
      // Load collaborators so the app knows whether this trip is shared (which
      // drives polling/locking) and to populate the Share modal instantly.
      void (async () => {
        try {
          const lres = await fetch(`/api/trips/${tripId}/collaborators`)
          if (lres.ok) {
            const ld: { collaborators?: Collaborator[]; canManage?: boolean } = await lres.json()
            setCollaborators(ld.collaborators ?? [])
            setCollaboratorsCanManage(Boolean(ld.canManage))
          }
        } catch {
          // non-critical
        }
      })()
    } catch {
      setSaveError('Could not open this saved trip.')
      setCanvasState('setup')
    } finally {
      setIsLoadingTrips(false)
    }
  }, [enrichRoutes])

  const updateItinerary = useCallback((newItinerary: Itinerary) => {
    setItinerary(newItinerary)
    // Collaborative trips debounce-autosave so others see manual edits.
    if (liveRef.current.isCollaborative && liveRef.current.canEdit && liveRef.current.savedTripId) {
      scheduleAutosave()
    }
  }, [scheduleAutosave])

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

  const deleteSavedTrip = useCallback(async (tripId: string) => {
    if (!userId || !tripId) return false

    setSaveStatus(null)
    setSaveError(null)

    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })

      if (!res.ok) throw new Error('Unable to delete trip')

      setSavedTrips((prev) => prev.filter((trip) => trip.id !== tripId))
      // If the trip currently open in the planner was deleted, reset back to a
      // clean setup so we are not editing a plan that no longer exists.
      if (savedTripId === tripId) {
        startNewTrip()
      }
      setSaveStatus('Deleted trip')
      return true
    } catch {
      setSaveError('Could not delete this trip.')
      return false
    }
  }, [userId, savedTripId, startNewTrip])

  const loadCollaborators = useCallback(async (tripId: string) => {
    setIsLoadingCollaborators(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`)
      if (!res.ok) throw new Error('Unable to load collaborators')
      const data: { collaborators?: Collaborator[]; canManage?: boolean } = await res.json()
      setCollaborators(data.collaborators ?? [])
      setCollaboratorsCanManage(Boolean(data.canManage))
    } catch {
      setCollaborators([])
      setCollaboratorsCanManage(false)
    } finally {
      setIsLoadingCollaborators(false)
    }
  }, [])

  const inviteCollaborator = useCallback(
    async (email: string, role: CollaboratorRole): Promise<{ ok: boolean; error?: string }> => {
      if (!savedTripId) return { ok: false, error: 'Save this trip before sharing it.' }
      try {
        const res = await fetch(`/api/trips/${savedTripId}/collaborators`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        })
        const data: { collaborator?: Collaborator; error?: string; message?: string } = await res.json()
        if (!res.ok || !data.collaborator) {
          return { ok: false, error: data.message || 'Unable to share with that email.' }
        }
        const invited = data.collaborator
        setCollaborators((prev) => [...prev.filter((c) => c.userId !== invited.userId), invited])
        return { ok: true }
      } catch {
        return { ok: false, error: 'Unable to share this trip right now.' }
      }
    },
    [savedTripId]
  )

  const setCollaboratorRole = useCallback(
    async (targetUserId: string, role: CollaboratorRole): Promise<boolean> => {
      if (!savedTripId) return false
      try {
        const res = await fetch(`/api/trips/${savedTripId}/collaborators/${targetUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        })
        if (!res.ok) return false
        setCollaborators((prev) => prev.map((c) => (c.userId === targetUserId ? { ...c, role } : c)))
        return true
      } catch {
        return false
      }
    },
    [savedTripId]
  )

  const removeCollaborator = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!savedTripId) return false
      try {
        const res = await fetch(`/api/trips/${savedTripId}/collaborators/${targetUserId}`, {
          method: 'DELETE',
        })
        if (!res.ok) return false
        setCollaborators((prev) => prev.filter((c) => c.userId !== targetUserId))
        return true
      } catch {
        return false
      }
    },
    [savedTripId]
  )

  const leaveSharedTrip = useCallback(
    async (tripId: string): Promise<boolean> => {
      if (!userId || !tripId) return false
      try {
        const res = await fetch(`/api/trips/${tripId}/collaborators/${userId}`, { method: 'DELETE' })
        if (!res.ok) return false
        setSavedTrips((prev) => prev.filter((trip) => trip.id !== tripId))
        if (savedTripId === tripId) startNewTrip()
        return true
      } catch {
        return false
      }
    },
    [userId, savedTripId, startNewTrip]
  )

  const loadComments = useCallback(async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/comments`)
      if (!res.ok) return
      const data: { comments?: TripComment[] } = await res.json()
      setComments(data.comments ?? [])
    } catch {
      // non-critical
    }
  }, [])

  const addComment = useCallback(
    async (body: string, anchor: CommentAnchor): Promise<boolean> => {
      if (!savedTripId) return false
      try {
        const res = await fetch(`/api/trips/${savedTripId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body,
            anchorType: anchor.type,
            anchorDay: anchor.day ?? null,
            anchorActivityId: anchor.activityId ?? null,
          }),
        })
        if (!res.ok) return false
        const data: { comment: TripComment } = await res.json()
        setComments((prev) => [...prev, data.comment])
        return true
      } catch {
        return false
      }
    },
    [savedTripId]
  )

  const toggleCommentResolved = useCallback(
    async (commentId: string, resolved: boolean): Promise<boolean> => {
      if (!savedTripId) return false
      try {
        const res = await fetch(`/api/trips/${savedTripId}/comments/${commentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved }),
        })
        if (!res.ok) return false
        const data: { comment: TripComment } = await res.json()
        setComments((prev) => prev.map((c) => (c.id === commentId ? data.comment : c)))
        return true
      } catch {
        return false
      }
    },
    [savedTripId]
  )

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!savedTripId) return false
      try {
        const res = await fetch(`/api/trips/${savedTripId}/comments/${commentId}`, { method: 'DELETE' })
        if (!res.ok) return false
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        return true
      } catch {
        return false
      }
    },
    [savedTripId]
  )

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
    version,
    tripRole,
    collaborators,
    collaboratorsCanManage,
    isLoadingCollaborators,
    submitSetup,
    startNewTrip,
    sendMessage,
    updateItinerary,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
    updateSavedTripPublishStatus,
    deleteSavedTrip,
    retry,
    loadCollaborators,
    inviteCollaborator,
    setCollaboratorRole,
    removeCollaborator,
    leaveSharedTrip,
    comments,
    loadComments,
    addComment,
    toggleCommentResolved,
    deleteComment,
    dayLocks,
    aiLock,
    presence,
    heldDay,
    isCollaborativeTrip,
    acquireDayLock,
  }
}
