'use client'

import type { CanvasState, ClarificationData, Itinerary, LocationFocus, StorageState } from '@/types/travel'
import { ClarificationCard } from './ClarificationCard'
import { ItineraryDashboard } from './ItineraryDashboard'
import { LocationFocusPanel } from './LocationFocusPanel'

interface Props {
  canvasState: CanvasState
  itinerary: Itinerary | null
  locationFocus: LocationFocus | null
  clarification: ClarificationData | null
  isLoading: boolean
  storageState: StorageState
  onSend: (text: string) => void
}

export function CanvasPanel({
  canvasState,
  itinerary,
  locationFocus,
  clarification,
  isLoading,
  storageState,
  onSend,
}: Props) {
  if (canvasState === 'loading') {
    return (
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden border-l border-cyan-300/15 bg-slate-950/50 p-8 backdrop-blur-sm">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-7 grid h-20 w-20 place-items-center rounded-full border border-cyan-300/40 bg-cyan-300/5 shadow-[0_0_60px_rgba(0,255,209,0.2)]">
            <div className="h-12 w-12 animate-spin rounded-full border border-fuchsia-400/30 border-t-cyan-300" />
          </div>
          <p className="glitch text-sm font-semibold uppercase tracking-[0.34em] text-cyan-200">Compiling route grid</p>
          <p className="mt-4 text-sm leading-6 text-slate-400">Parsing traveler signals, map anchors, time windows, and route pressure.</p>
        </div>
      </div>
    )
  }

  if (canvasState === 'itinerary' && itinerary) {
    return <ItineraryDashboard itinerary={itinerary} storageState={storageState} />
  }

  if (locationFocus) {
    return (
      <LocationFocusPanel
        locationFocus={locationFocus}
        clarification={clarification}
        isLoading={isLoading}
        onSend={onSend}
      />
    )
  }

  if (canvasState === 'clarification' && clarification) {
    return <ClarificationCard clarification={clarification} onSend={onSend} isLoading={isLoading} />
  }

  return <IntroPanel />
}

function IntroPanel() {
  return (
    <section className="relative z-10 flex flex-1 items-center overflow-hidden border-l border-cyan-300/15 bg-slate-950/35 px-12 py-10 backdrop-blur-sm">
      <div className="absolute inset-0 opacity-70">
        <div className="data-stream absolute right-10 top-10 h-48 w-40 text-[10px] leading-4 text-cyan-300/30">
          0110 1001 1110 0010<br />
          ROUTE_SIGNAL: ONLINE<br />
          MAP_GRID: ACTIVE<br />
          LATENCY: 18MS<br />
          HOME_BASE: WAITING<br />
          1011 0101 0011 1110
        </div>
      </div>

      <div className="max-w-4xl">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.42em] text-cyan-300">AtlasLoop neural travel grid</p>
        <h1 className="glitch max-w-4xl text-7xl font-semibold leading-[0.96] tracking-normal text-white">
          Your itinerary is not written. It is rendered.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
          Start with a destination in the console. AtlasLoop will ask only what it needs, lock your home base on the map,
          then generate a route-aware travel dashboard with time pressure, cost, and movement intelligence.
        </p>

        <div className="mt-10 grid max-w-3xl grid-cols-3 gap-4">
          <SignalCard label="Ask" value="AI briefing" />
          <SignalCard label="Lock" value="home base" />
          <SignalCard label="Render" value="route grid" />
        </div>
      </div>
    </section>
  )
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-cyan-300/20 bg-slate-950/55 p-4 shadow-[0_0_34px_rgba(0,255,209,0.08)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/70">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
