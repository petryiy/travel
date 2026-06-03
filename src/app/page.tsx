'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { Dashboard } from '@/components/dashboard/Dashboard'

export default function Home() {
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
    submitSetup,
    startNewTrip,
    sendMessage,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
  } = useChat()

  function handleNewTrip() {
    startNewTrip()
    setPresentationMode('edit')
    setView('planner')
  }

  function handleOpenSavedTrip(tripId: string) {
    setPresentationMode('overview')
    setView('planner')
    void openSavedTrip(tripId)
  }

  function handleBackToDashboard() {
    setView('dashboard')
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        savedTrips={savedTrips}
        isLoadingTrips={isLoadingTrips}
        onNewTrip={handleNewTrip}
        onOpenTrip={handleOpenSavedTrip}
      />
    )
  }

  const showChatPanel = presentationMode === 'edit'

  return (
    <div className="flex h-full overflow-hidden">
      {showChatPanel && (
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
        savedTrips={savedTrips}
        isSaving={isSaving}
        isLoadingTrips={isLoadingTrips}
        saveStatus={saveStatus}
        saveError={saveError}
        presentationMode={presentationMode}
        onSetup={submitSetup}
        onSend={sendMessage}
        onSave={saveCurrentTrip}
        onOpenSavedTrip={handleOpenSavedTrip}
        onRenameSavedTrip={renameSavedTripTitle}
        onPresentationModeChange={setPresentationMode}
        onBackToDashboard={handleBackToDashboard}
      />
    </div>
  )
}
