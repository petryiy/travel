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
  authorName: string | null
  savedTripIsPublished: boolean
  savedTrips: SavedTripSummary[]
  isSaving: boolean
  isLoadingTrips: boolean
  saveStatus: string | null
  saveError: string | null
  presentationMode: 'overview' | 'edit'
  onSetup: (details: TripDetails) => void
  onSend: (text: string) => void
  onUpdateItinerary: (itinerary: Itinerary) => void
  onSave: () => void
  onOpenSavedTrip: (tripId: string) => void
  onRenameSavedTrip: (title: string) => Promise<boolean>
  onPublishSavedTrip: (isPublished: boolean) => Promise<boolean>
  onPresentationModeChange: (mode: 'overview' | 'edit') => void
  onBackToDashboard: () => void
  onRetry: () => void
}

export function CanvasPanel({
  canvasState,
  itinerary,
  clarification,
  isLoading,
  savedTripId,
  savedTripTitle,
  authorName,
  savedTripIsPublished,
  savedTrips,
  isSaving,
  isLoadingTrips,
  saveStatus,
  saveError,
  presentationMode,
  onSetup,
  onSend,
  onUpdateItinerary,
  onSave,
  onOpenSavedTrip,
  onRenameSavedTrip,
  onPublishSavedTrip,
  onPresentationModeChange,
  onBackToDashboard,
  onRetry,
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
      <div className="flex min-w-0 flex-1 items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-bounce">✈️</div>
          <p className="text-zinc-600 font-medium">Gemini is planning your trip…</p>
          <p className="text-zinc-400 text-sm">This might take a moment</p>
        </div>
      </div>
    )
  }

  if (canvasState === 'error') {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50">
        <div className="text-center space-y-4 max-w-xs px-6">
          <div className="text-5xl">😔</div>
          <div>
            <p className="text-zinc-800 font-semibold">Something went wrong</p>
            <p className="text-zinc-500 text-sm mt-1">Could not reach the AI. Check your connection and try again.</p>
          </div>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Try again
          </button>
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
          savedTripId={savedTripId}
          authorName={authorName}
          isPublished={savedTripIsPublished}
          onBackToDashboard={onBackToDashboard}
          onEdit={() => onPresentationModeChange('edit')}
          onRenameTitle={onRenameSavedTrip}
          onPublishChange={onPublishSavedTrip}
        />
      )
    }

    return (
      <ItineraryDashboard
        itinerary={itinerary}
        savedTripTitle={savedTripTitle}
        savedTripId={savedTripId}
        isSaving={isSaving}
        saveStatus={saveStatus}
        saveError={saveError}
        onSave={onSave}
        onUpdateItinerary={onUpdateItinerary}
        onOverview={() => onPresentationModeChange('overview')}
        onBackToDashboard={onBackToDashboard}
      />
    )
  }

  // Fallback: still loading or transitioning
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center bg-zinc-50">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
      </div>
    </div>
  )
}
