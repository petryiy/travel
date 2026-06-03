'use client'

import type { CanvasState, TripDetails, Itinerary, ClarificationData, SavedTripSummary } from '@/types/travel'
import { SetupForm } from './SetupForm'
import { ClarificationCard } from './ClarificationCard'
import { ItineraryDashboard } from './ItineraryDashboard'
import { ItineraryOverview } from './ItineraryOverview'

interface Props {
  canvasState: CanvasState
  itinerary: Itinerary | null
  clarification: ClarificationData | null
  isLoading: boolean
  savedTripId: string | null
  savedTripTitle: string | null
  savedTrips: SavedTripSummary[]
  isSaving: boolean
  isLoadingTrips: boolean
  saveStatus: string | null
  saveError: string | null
  presentationMode: 'overview' | 'edit'
  onSetup: (details: TripDetails) => void
  onSend: (text: string) => void
  onSave: () => void
  onOpenSavedTrip: (tripId: string) => void
  onRenameSavedTrip: (title: string) => Promise<boolean>
  onPresentationModeChange: (mode: 'overview' | 'edit') => void
  onBackToDashboard: () => void
}

export function CanvasPanel({
  canvasState,
  itinerary,
  clarification,
  isLoading,
  savedTripId,
  savedTripTitle,
  savedTrips,
  isSaving,
  isLoadingTrips,
  saveStatus,
  saveError,
  presentationMode,
  onSetup,
  onSend,
  onSave,
  onOpenSavedTrip,
  onRenameSavedTrip,
  onPresentationModeChange,
  onBackToDashboard,
}: Props) {
  if (canvasState === 'setup') {
    return (
      <SetupForm
        savedTrips={savedTrips}
        isLoadingSavedTrips={isLoadingTrips}
        onSubmit={onSetup}
        onOpenSavedTrip={onOpenSavedTrip}
      />
    )
  }

  if (canvasState === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-bounce">✈️</div>
          <p className="text-zinc-600 font-medium">Gemini is planning your trip…</p>
          <p className="text-zinc-400 text-sm">This might take a moment</p>
        </div>
      </div>
    )
  }

  if (canvasState === 'clarification' && clarification) {
    return <ClarificationCard clarification={clarification} onSend={onSend} isLoading={isLoading} />
  }

  if (canvasState === 'itinerary' && itinerary) {
    if (presentationMode === 'overview') {
      return (
        <ItineraryOverview
          itinerary={itinerary}
          savedTripTitle={savedTripTitle}
          onBackToDashboard={onBackToDashboard}
          onEdit={() => onPresentationModeChange('edit')}
          onRenameTitle={onRenameSavedTrip}
        />
      )
    }

    return (
      <ItineraryDashboard
        itinerary={itinerary}
        savedTripId={savedTripId}
        isSaving={isSaving}
        saveStatus={saveStatus}
        saveError={saveError}
        onSave={onSave}
        onOverview={() => onPresentationModeChange('overview')}
      />
    )
  }

  // Fallback: still loading or transitioning
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-50">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
      </div>
    </div>
  )
}
