'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CanvasState, ClarificationData, Itinerary, LocationFocus, StorageState } from '@/types/travel'
import { ItineraryDashboard } from './ItineraryDashboard'

interface Props {
  canvasState: CanvasState
  itinerary: Itinerary | null
  locationFocus: LocationFocus | null
  clarification: ClarificationData | null
  isLoading: boolean
  storageState: StorageState
  onSend: (text: string) => void
  onReset: () => void
}

const INTRO_LINES = [
  'Signal-based travel planning.',
  'Route intelligence.',
  'Home-base lock.',
  'Feasibility rendered in real time.',
]

const DEFAULT_QUESTION: ClarificationData = {
  question: 'Where should I plot the trip?',
  suggestions: ['Sydney', 'Tokyo', 'Paris'],
}

export function ImmersiveExperience({
  canvasState,
  itinerary,
  locationFocus,
  clarification,
  isLoading,
  storageState,
  onSend,
  onReset,
}: Props) {
  const [entered, setEntered] = useState(false)
  const [input, setInput] = useState('')
  const activeQuestion = clarification ?? DEFAULT_QUESTION
  const showDashboard = canvasState === 'itinerary' && itinerary

  useEffect(() => {
    if (showDashboard) return

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 8) setEntered(true)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [showDashboard])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value || isLoading) return
    onSend(value)
    setInput('')
    setEntered(true)
  }

  if (showDashboard) {
    return <ItineraryDashboard itinerary={itinerary} storageState={storageState} onReset={onReset} />
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#02030d] text-white">
      <DeepSpaceBackground entered={entered} />

      <section className={`intro-layer ${entered ? 'intro-layer-exit' : ''}`}>
        <div className="intro-copy">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.44em] text-cyan-200/80">AtlasLoop</p>
          <h1 className="floating-title text-7xl font-semibold leading-[0.95] tracking-normal text-white md:text-8xl">
            Navigate the unknown.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            An AI travel system that turns scattered intent into a route-aware mission plan.
          </p>
          <div className="mt-8 grid max-w-3xl gap-2 text-sm text-cyan-100/55 sm:grid-cols-4">
            {INTRO_LINES.map((line) => (
              <span key={line} className="rounded-full border border-cyan-200/15 bg-white/5 px-3 py-2 backdrop-blur-md">
                {line}
              </span>
            ))}
          </div>
          <p className="mt-12 text-xs uppercase tracking-[0.32em] text-cyan-100/45">Scroll to enter orbit</p>
        </div>
      </section>

      <section className={`orbit-layer ${entered ? 'orbit-layer-active' : ''}`}>
        <HolographicEarth locationFocus={locationFocus} />
        <AIGlassTerminal
          question={activeQuestion}
          input={input}
          isLoading={isLoading}
          locationFocus={locationFocus}
          onInput={setInput}
          onSubmit={handleSubmit}
          onSuggestion={(value) => {
            setEntered(true)
            onSend(value)
          }}
        />
      </section>
    </main>
  )
}

function DeepSpaceBackground({ entered }: { entered: boolean }) {
  return (
    <div className={`deep-space ${entered ? 'deep-space-entered' : ''}`} aria-hidden="true">
      <div className="nebula nebula-a" />
      <div className="nebula nebula-b" />
      <div className="star-layer star-layer-a" />
      <div className="star-layer star-layer-b" />
      <div className="shooting-star shooting-star-a" />
      <div className="shooting-star shooting-star-b" />
      <div className="shooting-star shooting-star-c" />
    </div>
  )
}

function HolographicEarth({ locationFocus }: { locationFocus: LocationFocus | null }) {
  const label = locationFocus?.name ?? 'Awaiting home base'
  const coords = locationFocus
    ? `${locationFocus.coordinates.lat.toFixed(4)}, ${locationFocus.coordinates.lng.toFixed(4)}`
    : 'Coordinate stream pending'

  return (
    <div className="earth-stage" aria-hidden="true">
      <div className="earth-halo" />
      <div className="holo-earth">
        <div className="earth-grid earth-grid-a" />
        <div className="earth-grid earth-grid-b" />
        <div className="earth-shine" />
        {locationFocus && <div className="earth-pin" />}
      </div>
      <div className="earth-readout">
        <p>{label}</p>
        <span>{coords}</span>
      </div>
    </div>
  )
}

function AIGlassTerminal({
  question,
  input,
  isLoading,
  locationFocus,
  onInput,
  onSubmit,
  onSuggestion,
}: {
  question: ClarificationData
  input: string
  isLoading: boolean
  locationFocus: LocationFocus | null
  onInput: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onSuggestion: (value: string) => void
}) {
  const prompt = useMemo(() => {
    if (locationFocus) return question.question
    return question.question
  }, [locationFocus, question.question])

  return (
    <div className="terminal-shell">
      <div className="terminal-border" />
      <div className="terminal-glass">
        <div className="mb-7 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
            AI mission terminal
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-white">{prompt}</h2>
          {locationFocus && (
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-cyan-100/60">
              Home base locked at {locationFocus.name}. The orbit model is recalibrating around your anchor.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
          <div className="terminal-input-wrap">
            <input
              value={input}
              onChange={(event) => onInput(event.target.value)}
              disabled={isLoading}
              placeholder="Type your answer..."
              className="terminal-input"
            />
            <button disabled={!input.trim() || isLoading} className="terminal-send" type="submit">
              {isLoading ? 'Syncing' : 'Transmit'}
            </button>
          </div>
        </form>

        {question.suggestions && question.suggestions.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {question.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestion(suggestion)}
                disabled={isLoading}
                className="floating-option"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
