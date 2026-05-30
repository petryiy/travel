'use client'

import { useState, useCallback } from 'react'
import type { Message, TripDetails, CanvasState, Itinerary, ClarificationData, GeminiResponse } from '@/types/travel'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [canvasState, setCanvasState] = useState<CanvasState>('setup')
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [clarification, setClarification] = useState<ClarificationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const callGemini = useCallback(async (nextMessages: Message[], details?: TripDetails) => {
    setIsLoading(true)
    setCanvasState((prev) => (prev === 'setup' ? 'loading' : prev))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, tripDetails: details }),
      })

      const data: GeminiResponse = await res.json()

      const assistantMessage: Message = { role: 'assistant', content: data.message }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.canvas.type === 'clarification' && data.canvas.clarification) {
        setClarification(data.canvas.clarification)
        setCanvasState('clarification')
      } else if (data.canvas.type === 'itinerary' && data.canvas.itinerary) {
        setItinerary(data.canvas.itinerary)
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

    const styleLabel = details.style.charAt(0).toUpperCase() + details.style.slice(1)
    const opener: Message = {
      role: 'user',
      content: `I want to plan a trip to ${details.destination}. I'll be traveling from ${details.startDate} to ${details.endDate} with ${details.travelers} traveler${details.travelers > 1 ? 's' : ''}. My preferred style is: ${styleLabel}. Please help me plan this trip!`,
    }

    setMessages([opener])
    await callGemini([opener], details)
  }, [callGemini])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    await callGemini(nextMessages, tripDetails ?? undefined)
  }, [messages, tripDetails, callGemini])

  return {
    messages,
    canvasState,
    tripDetails,
    itinerary,
    clarification,
    isLoading,
    submitSetup,
    sendMessage,
  }
}
