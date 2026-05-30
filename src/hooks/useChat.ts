'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  CanvasState,
  ClarificationData,
  GeminiResponse,
  Itinerary,
  Message,
  StorageState,
  TripDetails,
} from '@/types/travel'

const SESSION_KEY = 'atlasloop-session-id'

function sessionId() {
  if (typeof window === 'undefined') return 'server-session'

  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing

  const next =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(SESSION_KEY, next)
  return next
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [canvasState, setCanvasState] = useState<CanvasState>('setup')
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [clarification, setClarification] = useState<ClarificationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [storageState, setStorageState] = useState<StorageState>({
    configured: false,
    status: 'idle',
    message: 'Checking DynamoDB storage.',
  })

  useEffect(() => {
    let active = true

    fetch('/api/storage/status')
      .then((response) => response.json())
      .then((data: { configured: boolean; tableName?: string | null }) => {
        if (!active) return
        setStorageState({
          configured: data.configured,
          status: data.configured ? 'idle' : 'unavailable',
          message: data.configured
            ? `DynamoDB table ready: ${data.tableName ?? 'configured table'}`
            : 'DynamoDB is not configured in this environment.',
        })
      })
      .catch(() => {
        if (!active) return
        setStorageState({
          configured: false,
          status: 'error',
          message: 'Unable to check storage configuration.',
        })
      })

    return () => {
      active = false
    }
  }, [])

  const saveTrip = useCallback(async (nextItinerary: Itinerary) => {
    setStorageState((prev) => ({
      ...prev,
      status: prev.configured ? 'saving' : 'unavailable',
      message: prev.configured ? 'Saving itinerary to DynamoDB.' : prev.message,
    }))

    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId(),
          itinerary: nextItinerary,
        }),
      })
      const data = (await response.json()) as {
        saved: boolean
        configured: boolean
        record?: { createdAt: string; itinerary: Itinerary }
        message?: string
      }

      if (!data.configured) {
        setStorageState({
          configured: false,
          status: 'unavailable',
          message: data.message ?? 'DynamoDB is not configured in this environment.',
        })
        return
      }

      if (data.saved && data.record) {
        setItinerary(data.record.itinerary)
        setStorageState({
          configured: true,
          status: 'saved',
          message: 'Itinerary saved to DynamoDB.',
          lastSavedAt: data.record.createdAt,
        })
        return
      }

      setStorageState({
        configured: true,
        status: 'error',
        message: 'DynamoDB returned without saving the itinerary.',
      })
    } catch {
      setStorageState({
        configured: true,
        status: 'error',
        message: 'Unable to save this itinerary to DynamoDB.',
      })
    }
  }, [])

  const callAssistant = useCallback(
    async (nextMessages: Message[], details?: TripDetails) => {
      setIsLoading(true)
      setCanvasState((prev) => (prev === 'setup' ? 'loading' : prev))

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages, tripDetails: details }),
        })

        const data = (await response.json()) as GeminiResponse
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])

        if (data.canvas.type === 'clarification' && data.canvas.clarification) {
          setClarification(data.canvas.clarification)
          setCanvasState('clarification')
          return
        }

        if (data.canvas.type === 'itinerary' && data.canvas.itinerary) {
          setClarification(null)
          setItinerary(data.canvas.itinerary)
          setCanvasState('itinerary')
          void saveTrip(data.canvas.itinerary)
          return
        }

        setCanvasState((prev) => (prev === 'loading' ? 'clarification' : prev))
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'I hit a planning issue. Please try one more message.' },
        ])
        setCanvasState('clarification')
      } finally {
        setIsLoading(false)
      }
    },
    [saveTrip]
  )

  const submitSetup = useCallback(
    async (details: TripDetails) => {
      setTripDetails(details)

      const opener: Message = {
        role: 'user',
        content: [
          `Plan a trip to ${details.destination}.`,
          `Dates: ${details.startDate} to ${details.endDate}.`,
          `Travelers: ${details.travelers}.`,
          `Style: ${details.style}.`,
          `Pace: ${details.pace}.`,
          `Budget: ${details.budget}.`,
          `Transport: ${details.transport}.`,
          details.homeBase ? `Preferred base: ${details.homeBase}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      }

      setMessages([opener])
      await callAssistant([opener], details)
    },
    [callAssistant]
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: Message = { role: 'user', content: text }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      await callAssistant(nextMessages, tripDetails ?? undefined)
    },
    [messages, tripDetails, callAssistant]
  )

  return {
    messages,
    canvasState,
    tripDetails,
    itinerary,
    clarification,
    isLoading,
    storageState,
    submitSetup,
    sendMessage,
  }
}
