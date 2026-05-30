'use client'

import type { CanvasState, ClarificationData, Itinerary, StorageState, TripDetails } from '@/types/travel'
import { ClarificationCard } from './ClarificationCard'
import { ItineraryDashboard } from './ItineraryDashboard'
import { SetupForm } from './SetupForm'

interface Props {
  canvasState: CanvasState
  itinerary: Itinerary | null
  clarification: ClarificationData | null
  isLoading: boolean
  storageState: StorageState
  onSetup: (details: TripDetails) => void
  onSend: (text: string) => void
}

export function CanvasPanel({
  canvasState,
  itinerary,
  clarification,
  isLoading,
  storageState,
  onSetup,
  onSend,
}: Props) {
  if (canvasState === 'setup') {
    return <SetupForm onSubmit={onSetup} />
  }

  if (canvasState === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f7f6f1] p-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full border border-slate-200 border-t-slate-900 animate-spin" />
          <p className="text-base font-semibold text-slate-950">Building your route-aware itinerary</p>
          <p className="mt-2 text-sm text-slate-500">The assistant is balancing places, timing, pace, and travel mode.</p>
        </div>
      </div>
    )
  }

  if (canvasState === 'clarification' && clarification) {
    return <ClarificationCard clarification={clarification} onSend={onSend} isLoading={isLoading} />
  }

  if (canvasState === 'itinerary' && itinerary) {
    return <ItineraryDashboard itinerary={itinerary} storageState={storageState} />
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400" />
      </div>
    </div>
  )
}
