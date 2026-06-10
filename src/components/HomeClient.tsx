'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { UserMenu } from '@/components/auth/UserMenu'
import { GuestSaveModal } from '@/components/auth/GuestSaveModal'

interface Props {
  userId: string | null
  userName: string | null
  userImage: string | null
}

export function HomeClient({ userId, userName, userImage }: Props) {
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [view, setView] = useState<'dashboard' | 'planner'>('dashboard')
  const [presentationMode, setPresentationMode] = useState<'overview' | 'edit'>('edit')

  const {
    messages,
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
    savedTripIsPublished,
  } = useChat(userId)

  function handleSave() {
    if (!userId) {
      setShowGuestModal(true)
      return
    }
    void saveCurrentTrip()
  }

  function handleNewTrip() {
    startNewTrip()
    setPresentationMode('edit')
    setView('planner')
  }

  // Opening a saved plan lands on the read-only overview first; the user can
  // switch to edit mode from there.
  function handleOpenTrip(tripId: string) {
    setPresentationMode('overview')
    setView('planner')
    void openSavedTrip(tripId)
  }

  function handleBackToDashboard() {
    setView('dashboard')
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-[#f4efe7]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dfd4c5] bg-[#fbf7ef] px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] sm:px-5 sm:py-3">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-[#3e3021] transition hover:text-[#5f7d59]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#6f8a68] shadow-[0_0_0_4px_rgba(111,138,104,0.16)] transition group-hover:scale-110" />
            MeetU
          </button>
          <UserMenu name={userName} image={userImage} />
        </header>

        {view === 'dashboard' ? (
          <Dashboard
            savedTrips={savedTrips}
            isLoadingTrips={isLoadingTrips}
            onNewTrip={handleNewTrip}
            onOpenTrip={handleOpenTrip}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            {presentationMode === 'edit' && (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
                hasItinerary={Boolean(itinerary)}
                onBackToDashboard={handleBackToDashboard}
              />
            )}
            <CanvasPanel
              canvasState={canvasState}
              itinerary={itinerary}
              clarification={clarification}
              isLoading={isLoading}
              savedTripId={savedTripId}
              savedTripTitle={savedTripTitle}
              authorName={userName}
              savedTripIsPublished={savedTripIsPublished}
              savedTrips={savedTrips}
              isSaving={isSaving}
              isLoadingTrips={isLoadingTrips}
              saveStatus={saveStatus}
              saveError={saveError}
              presentationMode={presentationMode}
              activeTab={activeTab}
              hotelCanvas={hotelCanvas}
              flightCanvas={flightCanvas}
              onSetup={submitSetup}
              onSend={sendMessage}
              onUpdateItinerary={updateItinerary}
              onSave={handleSave}
              onOpenSavedTrip={handleOpenTrip}
              onRenameSavedTrip={renameSavedTripTitle}
              onPublishSavedTrip={updateSavedTripPublishStatus}
              onPresentationModeChange={setPresentationMode}
              onBackToDashboard={handleBackToDashboard}
              onRetry={retry}
              onSwitchTab={switchTab}
              onFlightOriginSelect={selectFlightOrigin}
              onRetryHotels={retryHotels}
              onRetryFlights={retryFlights}
            />
          </div>
        )}
      </div>

      {showGuestModal && (
        <GuestSaveModal
          onClose={() => setShowGuestModal(false)}
          onSave={() => void saveCurrentTrip()}
        />
      )}
    </>
  )
}
