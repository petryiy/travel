'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { Dashboard } from '@/components/dashboard/Dashboard'

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'planner'>('dashboard')
  const {
    messages,
    canvasState,
    itinerary,
    clarification,
    isLoading,
    savedTripId,
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
  } = useChat()

  function handleNewTrip() {
    startNewTrip()
    setView('planner')
  }

  function handleOpenSavedTrip(tripId: string) {
    setView('planner')
    void openSavedTrip(tripId)
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

  return (
    <div className="flex h-full overflow-hidden">
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        onSend={sendMessage}
        hasItinerary={Boolean(itinerary)}
        onBackToDashboard={() => setView('dashboard')}
      />
      <CanvasPanel
        canvasState={canvasState}
        itinerary={itinerary}
        clarification={clarification}
        isLoading={isLoading}
        savedTripId={savedTripId}
        savedTrips={savedTrips}
        isSaving={isSaving}
        isLoadingTrips={isLoadingTrips}
        saveStatus={saveStatus}
        saveError={saveError}
        onSetup={submitSetup}
        onSend={sendMessage}
        onSave={saveCurrentTrip}
        onOpenSavedTrip={handleOpenSavedTrip}
      />
    </div>
  )
}
